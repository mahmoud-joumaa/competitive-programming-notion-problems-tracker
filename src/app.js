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

class Submission {

	constructor(submission_id, submission_timestamp, submission_verdict, problem_id, problem_name, problem_url, problem_difficulty, problem_tags) {
		// Submission Identifiers
		this.submission_id = submission_id;
		this.submission_timestamp = submission_timestamp;
		this.submission_verdict = submission_verdict;
		// Problem Identifiers
		this.problem_id = problem_id;
		this.problem_name = problem_name;
		this.problem_url = problem_url;
		this.problem_difficulty = problem_difficulty;
		this.problem_tags = problem_tags;
	}

	toString() {
		return `${this.problem_id} ${this.problem_name}`;
	}

}

class Platform {

	constructor(platform_name, user_id, last_submission_timestamp) {
		this.platform_name = platform_name; // name of the competitive programming platform
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

	async fetchSubmissions() {

		let submissions = [];

		// fetch all submissions of the current platform
		switch (this.platform_name) {
			case "codeforces":
				// @ts-ignore
				submissions = await axios.get(`${this.base_url}user.status?handle=${this.user_id}`)
				.catch(error => handleError(error));
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

			const new_submission = new Submission(submission_id, submission_timestamp, submission_verdict, problem_id, problem_name, problem_url, problem_difficulty, problem_tags);

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
	return await name.title[0].plain_text;
}

function updateNotionDB(platform, submission) {
}

// Application Handling ===========================================================================

function saveNewEnv(exit_code) {
	console.log(`\nApplication terminating at ${new Date(Date.now()*1000).toDateString()}\n`);
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
			submissions.forEach(async (submission) => {
					await updateNotionDB(platform, submission);
					console.log(`\tAdded ${submission}`);
			})

			// Update the last submission timestamp of each platform
			platform.last_submission_timestamp = 0;
		})();
	})

}

// ================================================================================================
// Running the Application
// ================================================================================================

main();
