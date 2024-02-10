// ================================================================================================
//  Imports & SDKs
// ================================================================================================

// Libraries & Packages ===========================================================================

const axios = require('axios');
const cheerio = require('cheerio');

const { Client } = require('@notionhq/client');

// Definitions & Initializations ==================================================================

const notion = new Client({ auth: process.env.NOTION_INTEGRATION_KEY });

// Classes ========================================================================================

class Submission {

	constructor(submission_id, submission_verdict, problem_id, problem_name, problem_url, problem_difficulty, problem_tags) {
		// Submission Identifiers
		this.submission_id = submission_id;
		this.submission_verdict = submission_verdict;
		// Problem Identifiers
		this.problem_id = problem_id;
		this.problem_name = problem_name;
		this.problem_url = problem_url;
		this.problem_difficulty = problem_difficulty;
		this.problem_tags = problem_tags;
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
			let problem_id = "";
			let problem_name = "";
			let problem_url = "";
			let problem_difficulty = "";
			let problem_tags = "";

			switch (this.platform_name) {
				case "codeforces":
					submission_id = submission.id;
					submission_verdict = "OK" ? true : false;
					problem_id = `${submission.problem.contestId}/${submission.problem.index}`;
					problem_name = submission.problem.name;
					problem_url = this.generateProblemUrl(problem_id);
					problem_difficulty = submission.problem.rating;
					problem_tags = submission.problem.tags;
					break;
			}

			const new_submission = new Submission(submission_id, submission_verdict, problem_id, problem_name, problem_url, problem_difficulty, problem_tags);
			console.log(`\tFetched "${problem_id} ${problem_name}" from ${problem_url}`)

			submissions.add(new_submission);

		})

		return submissions;

	}

};

// Functions ======================================================================================

function saveNewEnv() {
}

// ================================================================================================
//  Syncing the data across different platforms
// ================================================================================================

// Initialize all supported platforms
const codeforces = new Platform("codeforces", process.env.CODEFORCES_ID, Number(process.env.CODEFORCES_LAST_SUBMISSION_TIMESTAMP));
const leetcode = new Platform("leetcode", process.env.LEETCODE_ID, Number(process.env.LEETCODE_LAST_SUBMISSION_TIMESTAMP));

// Only add the platforms where the user has an id to the set
const platforms = new Set()
if (codeforces.user_id) platforms.add(codeforces);
if (leetcode.user_id) platforms.add(leetcode);

// Fetch submission from all supported platforms where the user has an id
platforms.forEach((platform) => {
	console.log(`\nFetching ${platform.platform_name} Problems...\n`);
	try {
		(async () => {
			const submissions = await platform.fetchSubmissions();
		})()
	}
	catch (error) {
		console.log(`Application crashed with the following error. Please retry after a short while:\n${error}\n`);
		saveNewEnv();
	}
})
