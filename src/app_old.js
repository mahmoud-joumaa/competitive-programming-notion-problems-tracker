// ================================================================================================
//  Imports & SDKs
// ================================================================================================

// Libraries & Packages ===========================================================================

const axios = require('axios');
const cheerio = require('cheerio');

const { Client } = require('@notionhq/client');

// Definitions & Initializations ==================================================================

const NOTION_INTEGRATION_KEY = process.env.NOTION_INTEGRATION_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notion = new Client({ auth: NOTION_INTEGRATION_KEY });

const NOTION_DB = getNotionDatabaseName();

// Classes ========================================================================================

class Problem {

	constructor(id, name, url, difficulty, tags) {
		this.id = id;
		this.name = name;
		this.url = url;
		this.difficulty = difficulty;
		this.tags = tags;
	}

	toString() {
		return `${this.id} ${this.name}`;
	}

}

class Submission {

	constructor(id, timestamp, verdict, url, problem) {
		this.id = id;
		this.timestamp = timestamp;
		this.verdict = verdict;
		this.url = url;
		this.problem = problem;
	}

	toString() {
		return `${this.id} ${this.problem}`;
	}

}

class Platform {

	constructor(platform_name, user_id, last_submission_timestamp) {
		this.platform_name = platform_name.toLowerCase(); // name of the competitive programming platform
		this.base_url = this.generateUrl();
		this.user_id = user_id; // username or handle used to uniquely identify an account on the platform
		this.last_submission_timestamp = last_submission_timestamp; // the last submission id after which to filter the query results
	}

	generateUrl() {

		let url = "";

		switch (this.platform_name) {
			case "codeforces":
				url = "https://codeforces.com/api/";
				break;
		}

		return url;

	}

	generateProblemUrl(problem_id) {

		let problem_url = "";

		switch (this.platform_name) {
			case "codeforces":
				problem_url = `https://codeforces.com/contest/${problem_id.split('/')[0]}/problem/${problem_id.split('/')[1]}`;
				break;
		}

		return problem_url;

	}

	generateSubmissionUrl(problem_id, submission_id) {

		let submission_url = "";

		switch (this.platform_name) {
			case "codeforces":
				submission_url = `https://codeforces.com/contest/${problem_id.split('/')[0]}/submission/${submission_id}`;
				break;
		}

		return submission_url;

	}

	async fetchSubmissions() {

		let submissions = [];

		// fetch all submissions of the current platform
		switch (this.platform_name) {
			case "codeforces":
				// @ts-ignore: axios has a 'get' property
				submissions = await axios.get(`${this.base_url}user.status?handle=${this.user_id}`);
				break;
		}

		// return only the submissions that have not been synced before
		return this.cleanSubmissions(submissions.data.result.filter((submission) => submission.creationTimeSeconds > this.last_submission_timestamp));

	}

	cleanSubmissions(submissions_data) {

		const submissions = new Set();

		// Encapsulate all the properties I need from each submission into a Submission object according to the platfrom from which it was fetched
		submissions_data.forEach((submission) => {

			let submission_id = "";
			let submission_verdict = false;
			let submission_timestamp = 0;
			let problem_id = "";
			let problem_name = "";
			let problem_url = "";
			let problem_difficulty = "";
			let problem_tags = [];

			switch (this.platform_name) {
				case "codeforces":
					submission_id = submission.id;
					submission_timestamp = submission.creationTimeSeconds;
					submission_verdict = "OK" ? true : false;
					problem_id = `${submission.problem.contestId}/${submission.problem.index}`;
					problem_name = submission.problem.name;
					problem_url = this.generateProblemUrl(problem_id);
					problem_difficulty = submission.problem.rating;
					problem_tags = submission.problem.tags;
					break;
			}

			const new_submission = new Submission(submission_id, submission_timestamp, submission_verdict, this.generateSubmissionUrl(problem_id, submission_id), new Problem(problem_id, problem_name, problem_url, problem_difficulty, problem_tags));

			console.log(`\tFetched from ${problem_url} \t ${new_submission}`)

			submissions.add(new_submission);

		})

		return submissions;

	}

	toString() {
		return this.platform_name;
	}

};

// Notion Interactions ============================================================================

async function getNotionDatabaseName() {
	const name = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
	// @ts-ignore: name will have a title property
	return await name.title[0].plain_text;
}

async function fetchNotionDBEntries() {
}

async function updateNotionDB(platform, submission) {
}

// Application Handling ===========================================================================

function saveNewEnv(exit_code) {
	const now = new Date(Date.now()*1000)
	console.log(`\nApplication terminating at ${now.toString()}\n`);
	process.exit(exit_code);
}

function handleError(error) {
	console.error(`\nApplication has terminated with the following error:\n${error}\n`);
	saveNewEnv(1);
}

// ================================================================================================
//  Syncing the data across different platforms
// ================================================================================================

function main() {

	// Initialize all supported platforms
	const codeforces = new Platform("codeforces", process.env.CODEFORCES_ID, Number(process.env.CODEFORCES_LAST_SUBMISSION_TIMESTAMP));
	const leetcode = new Platform("leetcode", process.env.LEETCODE_ID, Number(process.env.LEETCODE_LAST_SUBMISSION_TIMESTAMP));

	// Only add the platforms where the user has an id to the set
	const platforms = new Set()
	if (codeforces.user_id) platforms.add(codeforces);
	if (leetcode.user_id) platforms.add(leetcode);

	// Fetch submission from all supported platforms where the user has an id
	platforms.forEach((platform) => {

		console.log(`\nFetching ${platform} Problems...\n`);

		(async () => {

			// Get the submissions per platform
			const submissions = await platform.fetchSubmissions();

			// Update the Notion database accordingly
			console.log(`\nAdding ${platform} submissions to ${await NOTION_DB}...\n`);

			let maxTimestamp = 0;
			submissions.forEach(async (submission) => {
				maxTimestamp = Math.max(maxTimestamp, submission.submission_timestamp);
				await updateNotionDB(platform, submission);
				console.log(`\tAdded ${submission}`);
			})

			// Update the last submission timestamp of each platform
			platform.last_submission_timestamp = maxTimestamp;

		})();
	})

}

// ================================================================================================
// Running the Application
// ================================================================================================

// try {
// 	main();
// }
// catch (error) {
// 	handleError(error);
// }
