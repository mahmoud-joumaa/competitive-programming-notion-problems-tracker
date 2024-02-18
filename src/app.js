async function main() {

	// Libraries & Packages =========================================================================

	const axios = require('axios');
	const cheerio = require('cheerio');
	const crypto = require("crypto")

	const { Client } = require('@notionhq/client');

	// platform-specific consts
	const codeforces_name = "codeforces";
	const codeforces_id_threshold = 100000; // any id greater than this is placed in the gym

	const leetcode_name = "leetcode";

	const vjudge_name = "vjudge";

	// Classes ======================================================================================

	class Problem {

		constructor(platform, id, name, difficulty, tags) {
			this.id = id;
			this.name = name;
			this.url = Problem.generateUrl(platform, id);
			this.difficulty = difficulty;
			this.tags = tags;
		}

		static generateUrl(platform, id) {
			let problem_url = "";
			switch (platform.name) {
				case codeforces_name:
					const contest_id = id.split('/')[0];
					const problem_id = id.split('/')[1];
					problem_url = `https://codeforces.com/${(contest_id>codeforces_id_threshold)?"gym":"contest"}/${contest_id}/problem/${problem_id}`;
					break;
			}
			return problem_url;
		}

		toString() {
			return `${this.id} ${this.name}`;
		}

	}

	class Submission {

		constructor(id, verdict, url, problem) {
			this.id = id;
			this.verdict = verdict;
			this.url = url;
			this.problem = problem;
		}

		static generateUrl(platform, problem, id) {
			let submission_url = "";
			switch (platform.name) {
				case codeforces_name:
					const contest_id = problem.id.split('/')[0];
					submission_url = `https://codeforces.com/${(contest_id>codeforces_id_threshold)?"gym":"contest"}/${contest_id}/submission/${id}`;
					break;
			}
			return submission_url;
		}

		toString() {
			return `${this.id} ${this.problem}`;
		}

	}

	class Platform {

		constructor(name, user_id, last_submission_timestamp, key=null, secret=null) {
			this.name = name.toLowerCase();
			this.base_url = Platform.generateBaseUrl(name);
			this.max_url_length = Platform.getMaxUrlLength(name);
			this.user_id = user_id;
			this.last_submission_timestamp = last_submission_timestamp;
			this.key = key;
			this.secret = secret;
		}

		static generateBaseUrl(platform_name) {
			let url = "";
			switch (platform_name) {
				case codeforces_name:
					url = "https://codeforces.com/api";
					break;
			}
			return url;
		}

		static getMaxUrlLength(platform_name) {
			const extra = 5;
			let maxUrlLength = {problem: 0, submission: 0};
			switch (platform_name) {
				case codeforces_name:
					maxUrlLength.problem = 45;
					maxUrlLength.submission = 56;
					break;
			}
			maxUrlLength.problem += extra; maxUrlLength.submission += extra;
			return maxUrlLength;
		}

		static generateRandomString(n) {
			const dictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
			let rand = "";
			for (let i = 0; i < n; i++) {
				const index = Math.floor(Math.random() * (dictionary.length));
				rand += dictionary[index];
			}
			return rand;
		}

		async fetchData() {
			let submissions = [];
			// fetch all submissions of the current platform then return only the submissions that have not been synced before
			switch (this.name) {
				case codeforces_name:
					const now = Math.floor((new Date()).getTime()/1000);
					const randomSig = Platform.generateRandomString(6);
					const fetchRequestParams = `user.status?apiKey=${process.env.CODEFORCES_KEY}&handle=${process.env.CODEFORCES_ID}&time=${now}`;
					submissions = await axios.get(`${this.base_url}/${fetchRequestParams}&apiSig=${randomSig}${crypto.createHash('sha512').update(`${randomSig}/${fetchRequestParams}#${process.env.CODEFORCES_SECRET}`).digest('hex')}`);
					return (submissions.data.result).filter(submission => submission.creationTimeSeconds > this.last_submission_timestamp);
			}
		}

		getProblem(data) {
			let id; let name; let difficulty; let tags;
			switch (this.name) {
				case codeforces_name:
					id = `${data.problem.contestId}/${data.problem.index}`;
					name = `${data.problem.name}`;
					difficulty = `${data.problem.rating}`;
					tags = `${data.problem.tags}`;
					break;
			}
			return new Problem(this, id, name, difficulty, tags);
		}

		// constructor(id, verdict, url, problem)
		cleanSubmissions(submissions_data, problems) {
			let submissions = [];
			let id; let verdict; let url; let problem;
			for (let i = 0; i < problems.length; i++) {
				const submission = submissions_data[i];
				switch (this.name) {
					case codeforces_name:
						id = submission.id;
						verdict = submission.verdit;
						problem = problems[i];
						url = Submission.generateUrl(this, problem, id);
						break;
				}
				submissions.push(new Submission(id, verdict, url, problem));
			}
			return submissions;
		}

		toString() {
			return this.name;
		}

	}

	class Notion {

		constructor(api_key, db_id) {
			this.NOTION_INTEGRATION_KEY = api_key;
			this.NOTION_DATABASE_ID = db_id;
			this.notion = new Client({ auth: this.NOTION_INTEGRATION_KEY });
		}

		async getUser() {
			try {
				return (await this.notion.users.list()).results.find(({type}) => type == "person").name;
			}
			catch(error) {
				handleError(error);
			}
		}

		async getDB() {
			try {
				return (await this.notion.databases.retrieve({ database_id: this.NOTION_DATABASE_ID })).title[0].plain_text;
			}
			catch(error) {
				handleError(error);
			}
		}

		confirmCredentials(NOTION_USER, NOTION_DB) {
			const duration = 0;
			if (NOTION_USER)
				console.log(`Connected to workspace:\t${NOTION_USER}`);
			console.log(`Connected to database: \t${NOTION_DB}`);
			console.log(`\nTerminate the application within ${duration} seconds if the above credentials are incorrect...\n`);
			return new Promise((resolve) => {setTimeout(() => {resolve("====================\nSyncing Has Started\n====================")}, duration*1000)});
		}

		async fetchEntries() {
			const entries = [];
			let has_more = true;
			let next_cursor;
			while (has_more) {
				const query = await this.notion.databases.query({database_id: this.NOTION_DATABASE_ID, start_cursor: next_cursor});
				entries.push(...query.results);
				has_more = query.has_more;
				next_cursor = query.next_cursor;
			}
			return entries;
		}

		async updateDB(platform, submissions) {
			const entries = await this.fetchEntries();
			for (let entry of entries) {
				console.log(entry.properties.Platform.relation);
			}
		}

	}

	// Functions ====================================================================================

	function handleError(error) {
		console.error(`\nApplication has terminated with the following error:\n${error}\n`);
		exitApplication(1);
	}

	function exitApplication(exit_code) {
		console.log(`\nApplication terminating with error code ${exit_code} at ${new Date()}\n`);
		process.exit(exit_code);
	}

	// ==============================================================================================
	// Running the program
	// ==============================================================================================

	try {
		// Welcoming the user
		console.log("\n\n====================================================================================================\nWelcome to the Competitve Programming Problems Tracker in Notion\n====================================================================================================\n");

		// Initialize Notion
		console.log("\nDetecting Notion environment...")
		const notion = new Notion(process.env.NOTION_INTEGRATION_KEY, process.env.NOTION_DATABASE_ID);
		const NOTION_USER = (Number(process.env.DETECT_NOTION_USER) === 1) ? await notion.getUser() : null;
		const NOTION_DB = await notion.getDB();
		console.log("Detected Notion environment\n")

		console.log(`\n${await notion.confirmCredentials(NOTION_USER, NOTION_DB)}\n`);

		// Initialize all supported platforms
		const codeforces = new Platform(codeforces_name, process.env.CODEFORCES_ID, Number(process.env.CODEFORCES_LAST_SUBMISSION_TIMESTAMP), process.env.CODEFORCES_KEY, process.env.CODEFORCES_SECRET);
		const leetcode = new Platform(leetcode_name, process.env.LEETCODE_ID, Number(process.env.LEETCODE_LAST_SUBMISSION_TIMESTAMP));
		const vjudge = new Platform(vjudge_name, process.env.VJUDGE_ID, Number(process.env.VJUDGE_LAST_SUBMISSION_TIMESTAMP));

		// Only add the platforms where the user has an id to the set
		const platforms = new Set();
		if (codeforces.user_id) platforms.add(codeforces);
		// if (leetcode.user_id) platforms.add(leetcode);
		// if (vjudge.user_id) platforms.add(vjudge);

		// Fetch submission from all supported platforms where the user has an id
		for (let platform of platforms) {
			// Get the submissions per platform
			console.log(`\nFetching ${platform} submissions...`);
			const submissions_data = await platform.fetchData();
			let problems = [];
			for (let data of submissions_data) {
				const problem = platform.getProblem(data);
				console.log(`\tFetched from ${(problem.url).padEnd(platform.max_url_length.problem, " ")} ${problem}`);
				problems.push(problem);
			}
			console.log(`Fetched ${platform} submissions\n`)
			// Cleaning the submissions into a relevant format
			console.log(`\nFormatting ${platform} submissions...`)
			const submissions = platform.cleanSubmissions(submissions_data, problems);
			for (let submission of submissions) {
				console.log(`\tFormatted from ${(submission.url).padEnd(platform.max_url_length.submission, " ")} ${submission.problem}`);
			}
			console.log(`Formatted ${platform} submissions\n`)
			// Update the Notion database accordingly
			console.log(`\nAdding ${platform} submissions to ${NOTION_DB}...`);
			await notion.updateDB(platform, submissions);
			console.log(`Added ${platform} submissions to ${NOTION_DB}\n`);
			// Save the new .env information for each platform
			let maxTimestamp = 0;
			for (let submission of submissions) {
				// Update the maxTimestamp according to each submission
			}
			// Update the last submission timestamp of each platform
			platform.last_submission_timestamp = maxTimestamp;
		}

		// Save the updated information in .env
		console.log("\nSaving the updated information in the .env file...");
		console.log("Saved the updated information in the .env file\n");

		// Exit
		console.log("\nExiting the application...");
		exitApplication(0);
	}
	catch(error) {
		handleError(error);
	}

}

// ================================================================================================

main();
