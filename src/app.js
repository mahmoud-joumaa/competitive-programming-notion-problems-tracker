async function main() {

	// Libraries & Packages ===========================================================================

	const axios = require('axios');
	const cheerio = require('cheerio');
	const { Client } = require('@notionhq/client');

	// save the lowercase names of each platform (so if anything changes not to parse through all the case statements)
	const codeforces_name = "codeforces";
	const leetcode_name = "leetcode";

	// Classes ========================================================================================

	class Problem {

		constructor(id, name, url, difficulty, tags) {
			this.id = id;
			this.name = name;
			this.url = url;
			this.difficulty = difficulty;
			this.tags = tags;
		}

		static generateProblemUrl(platform_name) {
			let problem_url = "";
			switch (platform_name) {
				case codeforces_name:
					problem_url = ``;
					break;
			}
			return problem_url;
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

		static generateSubmissionUrl(platform_name) {
			let submission_url = "";
			switch (platform_name) {
				case codeforces_name:
					submission_url = ``;
					break;
			}
			return submission_url;
		}

		toString() {
			return `${this.id} ${this.problem}`;
		}

	}

	class Platform {

		constructor(name, user_id, last_submission_timestamp) {
			this.name = name.toLowerCase();
			this.base_url = Platform.generateBaseUrl(name);
			this.user_id = user_id;
			this.last_submission_timestamp = last_submission_timestamp;
		}

		static generateBaseUrl(platform_name) {
			let url = "";
			switch (platform_name) {
				case codeforces_name:
					url = "https://codeforces.com/api/";
					break;
			}
			return url;
		}

		async fetchSubmissions() {
			let submissions = [];
			// fetch all submissions of the current platform then return only the submissions that have not been synced before
			try { // TODO: Add throw new Error handling logic
				switch (this.name) {
					case codeforces_name:
						submissions = await axios.get(`${this.base_url}user.status?handle=${this.user_id}`);
						return (submissions.data.result).filter(submission => submission.creationTimeSeconds > this.last_submission_timestamp);
				}
			}
			catch(error) {
				handleError(error);
			}
		}

		cleanSubmissions() { // TODO: Add clean submissions logic
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
				return await ""; // TODO: Add detecting Notion Workspace logic
			}
			catch(error) {
				handleError(error);
			}
		}

		async getDB() {
			try {
				return (await this.notion.databases.retrieve({ database_id: this.NOTION_DATABASE_ID })).name.title[0].plain_text;
			}
			catch(error) {
				handleError(error);
			}
		}

		toString() {
		}

	}

	// Functions ====================================================================================

	function handleError(error) {
		console.error(`\nApplication has terminated with the following error:\n${error}\n`);
		exitApplication(1);
	}

	function exitApplication(exit_code) {
		const now = ""
		console.log(`\nApplication terminating at ${now}\n`);
		process.exit(exit_code);
	}

	// ==============================================================================================
	// Running the program
	// ==============================================================================================

	// Initialize Notion
	const notion = new Notion(process.env.NOTION_INTEGRATION_KEY, process.env.NOTION_DATABASE_ID);
	const NOTION_USER = notion.getUser();
	const NOTION_DB = notion.getDB();

	// Initialize all supported platforms
	const codeforces = new Platform(codeforces_name, process.env.CODEFORCES_ID, Number(process.env.CODEFORCES_LAST_SUBMISSION_TIMESTAMP));
	const leetcode = new Platform(leetcode_name, process.env.LEETCODE_ID, Number(process.env.LEETCODE_LAST_SUBMISSION_TIMESTAMP));

	// Only add the platforms where the user has an id to the set
	const platforms = new Set()
	if (codeforces.user_id) platforms.add(codeforces);
	if (leetcode.user_id) platforms.add(leetcode);

	// Fetch submission from all supported platforms where the user has an id
	for (let platform of platforms) {
		// Get the submissions per platform
		console.log(`\nFetching ${platform} Problems...\n`);
		const submissions = await platform.fetchSubmissions();
		// Update the Notion database accordingly
		console.log(`\nAdding ${platform} submissions to ${NOTION_DB}...\n`);
		// Save the new .env information for each platform
		let maxTimestamp = 0;
		for (let submission of submissions) {
		}
		// Update the last submission timestamp of each platform
		platform.last_submission_timestamp = maxTimestamp;
	}

}

// ================================================================================================

main();
