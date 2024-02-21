async function main() {

	// Libraries & Packages =========================================================================

	const axios = require('axios');
	const cheerio = require('cheerio');
	const crypto = require("crypto")

	const { Client } = require('@notionhq/client');

	// platform-specific properties
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

		constructor(id, url, timestamp, verdict, language, problem) {
			this.id = id;
			this.url = url;
			this.timestamp = timestamp;
			this.verdict = Platform.cleanVerdict(verdict);
			this.language = Platform.cleanLanguage(language);
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

		async getCode(platform) {
			switch (platform.name) {
				case codeforces_name:
					return cheerio.load((await axios.get(this.url)).data)("#program-source-text").text();
			}
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

		static cleanVerdict(verdict) {
			verdict = verdict.toLowerCase();
			if (verdict == "ok") return "accepted";
		}

		static cleanLanguage(language) {
			language = language.toLowerCase();
			if (language.includes("c++") || language.includes("cpp")) return "C++";
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
					tags = []; for (let tag of data.problem.tags) tags.push({ "name": tag });
					break;
			}
			return new Problem(this, id, name, difficulty, tags);
		}

		cleanSubmissions(submissions_data, problems) {
			let submissions = [];
			let id; let verdict; let url; let timestamp; let language; let problem;
			for (let i = 0; i < problems.length; i++) {
				const submission = submissions_data[i];
				switch (this.name) {
					case codeforces_name:
						id = submission.id;
						verdict = submission.verdict;
						timestamp = submission.creationTimeSeconds;
						language = submission.programmingLanguage;
						problem = problems[i];
						url = Submission.generateUrl(this, problem, id);
						break;
				}
				submissions.push(new Submission(id, url, timestamp, verdict, language, problem));
			}
			return submissions;
		}

		toString() {
			return this.name;
		}

	}

	class Entry {

		constructor(page_id, id, url, name, tags, platform, difficulty, languages_accepted, languages_attempted) {
			this.page_id = page_id;
			this.id = id;
			this.url = url;
			this.name = name;
			this.tags = tags;
			this.platform = platform;
			this.difficulty = difficulty;
			this.languages_accepted = languages_accepted;
			this.languages_attempted = languages_attempted;
		}

		static cleanEntry(entry) {
			const page_id = entry.id;
			const properties = entry.properties;
			const id = (properties["Problem ID"].rich_text.length > 0) ? properties["Problem ID"].rich_text[0].plain_text : null; if (!id) return null;
			const url = properties.URL.url;
			const name = (properties["Problem Name"].title.length > 0) ? properties["Problem Name"].title[0].plain_text : null; if (!name) return null;
			const tags = properties.Tags.multi_select; for (let i = 0; i < tags.length; i++) tags[i] = tags[i].name;
			const platform = properties.Platform.select.name;
			const difficulty = properties["Difficulty (Raw)"].rich_text[0].plain_text;
			const languages_accepted = properties["Languages Accepted"].multi_select; for (let i = 0; i < languages_accepted.length; i++) languages_accepted[i] = languages_accepted[i].name;
			const languages_attempted = properties["Languages Attempted"].multi_select; for (let i = 0; i < languages_attempted.length; i++) languages_attempted[i] = languages_attempted[i].name;
			return new Entry(page_id, id, url, name, tags, platform, difficulty, languages_accepted, languages_attempted);
		}

		toString() {
			return `${this.id} ${this.name} ${this.url}`;
		}

	}

	class Notion {

		constructor(api_key, db_id) {
			this.NOTION_INTEGRATION_KEY = api_key;
			this.NOTION_DATABASE_ID = db_id;
			this.notion = new Client({ auth: this.NOTION_INTEGRATION_KEY });
		}

		async getUser() {
			return (await this.notion.users.list()).results.find(({type}) => type == "person").name;
		}

		async getDB() {
			return (await this.notion.databases.retrieve({ database_id: this.NOTION_DATABASE_ID })).title[0].plain_text;
		}

		confirmCredentials(NOTION_USER, NOTION_DB) {
			const duration = 0;
			if (NOTION_USER)
				console.log(`Connected to workspace:\t${NOTION_USER}`);
			console.log(`Connected to database: \t${NOTION_DB}`);
			console.log(`\nTerminate the application within ${duration} seconds if the above credentials are incorrect...\n`);
			return new Promise((resolve) => {setTimeout(() => {resolve("====================\nSyncing Has Started\n====================")}, duration*1000)});
		}

		async createPage(platform, problem) {
			const page_data = {
				"parent": {
					"type": "database_id",
					"database_id": this.NOTION_DATABASE_ID
				},
				"properties": {
					"Problem ID": {
						"rich_text": [
							{
								"type": "text",
								"text": {
									"content": problem.id
								}
							}
						]
					},
					"Problem Name": {
						"title": [
							{
								"text": {
									"content": problem.name
								}
							}
						]
					},
					"URL": {
						"url": problem.url
					},
					"Difficulty (Raw)": {
						"rich_text": [
							{
								"type": "text",
								"text": {
									"content": problem.difficulty
								}
							}
						]
					},
					"Tags": {
						"multi_select": problem.tags
					},
					"Platform": {
						"select": {
							"name": platform.name
						}
					}
				}
			};
			return await this.notion.pages.create(page_data);
		}

		async fetchEntries(platform) {

			const entries = {};
			let has_more = true;
			let next_cursor = undefined;
			while (has_more) {
				// Fetch the first batch of entries
				const query = (await this.notion.databases.query({ database_id: this.NOTION_DATABASE_ID, filter: { "property": "Platform", "select": { "equals": platform.name } }, start_cursor: next_cursor }));
				// Clean the object and add it to the entries array
				for (let result of query.results) {
					const entry = Entry.cleanEntry(result);
					// If the entry is null, ignore it and continue to the next iteration. Otherwise, add it to entries
					if (!entry) continue;
					entries[entry.id] = entry;
					console.log(`\t\tFetched ${entry}`);
				}
				// Check if there are more entries to fetch
				has_more = query.has_more;
				next_cursor = query.next_cursor;
			}
			return entries;
		}

		convertToMultiSelect(option_names) {
			const options = [];
			for (let name of option_names) options.push({ "name": name });
			return options;
		}

		async updateAttemptedLanguages(id, values) {
			values = this.convertToMultiSelect(values);
			const data = {
				page_id: id,
				properties: {
					"Languages Attempted": {
						"multi_select": values
					}
				}
			}
			return await this.notion.pages.update(data);
		}

		async updateAcceptedLanguages(id, values) {
			values = this.convertToMultiSelect(values);
			const data = {
				page_id: id,
				properties: {
					"Languages Accepted": {
						"multi_select": values
					}
				}
			}
			return await this.notion.pages.update(data);
		}

		async appendCodeBlock(page_id, submission, code) {
			const data = {
				block_id: page_id,
				children: [
					{
						"type": "code",
						"code": {
							"language": submission.language.toLowerCase(),
							"caption": [
								{
									"type": "text",
									"text": {
										"content": submission.url,
										"link": {
											"url": submission.url
										}
									}
								}
							],
							"rich_text": [
								{
									"type": "text",
									"text": {
										"content": code
									}
								}
							]
						}
					}
				]
			}
			return await this.notion.blocks.children.append(data);
		}

		async updateDB(NOTION_DB, platform, submissions) {
			console.log(`\n\tFetching entries from ${NOTION_DB}...`)
			const entries = await this.fetchEntries(platform);
			console.log(`\tFetched entries from ${NOTION_DB}\n`)
			console.log(`\n\tProcessing Submissions...`)
			for (let submission of submissions) {
				const problem = submission.problem;
				// Check if this problem has not already been attempted before, add an entry for it
				if (!entries[problem.id]) {
					entries[problem.id] = Entry.cleanEntry(await this.createPage(platform, problem));
					console.log(`\t\tCreated ${problem}`);
				}
				else {
					console.log(`\t\tAlready fetched ${problem}`);
				}
				const entry = entries[problem.id];
				// Check if this problem was attempted before in this language
				if (!entry.languages_attempted.includes(submission.language)) {
					await this.updateAttemptedLanguages(entry.page_id, [...entry.languages_attempted, submission.language]);
				}
				console.log(`\t\t\t[PENDING] ${submission.language} solution for ${problem}`);
				// Check if this problem got accepted before in this language
				if (submission.verdict == "accepted") {
					// If this problem is getting accepted for the first time with this language, add it to the list of accepted languages
					if (!entries[problem.id].languages_accepted.includes(submission.language)) {
						await this.updateAcceptedLanguages(entry.page_id, [...entry.languages_accepted, submission.language]);
					}
					console.log(`\t\t\t[ACCPETED] ${submission.language} solution for ${problem} `);
					// Get the code submission of the accepted solution
					const code = await submission.getCode(platform);
					console.log(code);
					await this.appendCodeBlock(entry.page_id, submission, code);
				}
				else {
					console.log(`\t\t\t[REJECTED] ${submission.language} solution for ${problem}`);
				}
				// visually break the logs apart
				console.log();
			}
			console.log(`\tProcessed Submissions\n`)
		}

	}

	// Functions ====================================================================================

	function handleError(error, exit_code=1) {
		console.error(`\nApplication has terminated with the following error:\n${error}\n`);
		exitApplication(exit_code);
	}

	function exitApplication(exit_code=0) {
		console.log(`\nApplication terminating with exit code ${exit_code} at ${new Date()}\n`);
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
			console.log(`\nUpdating ${platform} submissions in ${NOTION_DB}...`);
			await notion.updateDB(NOTION_DB, platform, submissions);
			console.log(`Updated ${platform} submissions in ${NOTION_DB}\n`);
			// Save the new .env information for each platform
			let maxTimestamp = 0;
			for (let submission of submissions) {
				// Update the maxTimestamp according to each submission
				maxTimestamp = Math.max(maxTimestamp, submission.timestamp);
			}
			// Update the last submission timestamp of each platform
			platform.last_submission_timestamp = maxTimestamp;
		}

		// Save the updated information in .env
		console.log("\nSaving the updated information in the .env file...");
		console.log("Saved the updated information in the .env file\n");

		// Exit
		console.log("\nExiting the application...");
		exitApplication();
	}
	catch(error) {
		handleError(error);
	}

}

// ================================================================================================

main();
