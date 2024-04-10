async function main() {

	// Libraries & Packages =========================================================================

	const axios = require('axios');
	const cheerio = require('cheerio');
	const crypto = require("crypto");
	const fs = require('fs');

	const { Client } = require('@notionhq/client');

	// platform-specific properties
	const codeforces_name = "codeforces";
	const codeforces_id_threshold = 100000; // any id greater than this is placed in the gym

	const leetcode_name = "leetcode";
	const leetcode_limit = 20; // limit the number of retrieved objects per request
	const leetcode_query_get_problem = `
		query ($titleSlug: String!) {
			question(titleSlug: $titleSlug) {
				difficulty
				topicTags {
					name
				}
			}
		}
	`;

	const vjudge_name = "vjudge";
	const vjudge_max_results_length = 20; // the max that can be retrieved per request

	// NOTE: Avoid error with status code 429 by calling `await sleep(sleep_duration.platform_name)`
	const sleep_duration = {
		notion: 350,
		codeforces_name: 2000,
		leetcode_name: 1500,
		vjudge_name: 1500,
	};

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
				case vjudge_name:
					const oj = id.split('/')[0];
					const pb = id.split('/')[1];
					problem_url = `https://vjudge.net/problem/${oj}-${pb}`;
					break;
				case leetcode_name:
					problem_url = `https://leetcode.com/problems/${id.split('/')[1]}`;
					break;
			}
			return problem_url;
		}

		toString() {
			return `${this.id} ${this.name}`;
		}

	}

	class Submission {

		constructor(id, url, timestamp, verdict, language, problem, code=null) {
			this.id = id;
			this.url = url;
			this.timestamp = timestamp;
			this.verdict = Platform.cleanVerdict(verdict);
			this.language = Platform.cleanLanguage(language);
			this.problem = problem;
			this.code = code;
		}

		static generateUrl(platform, problem, id) {
			let submission_url = "";
			switch (platform.name) {
				case codeforces_name:
					const contest_id = problem.id.split('/')[0];
					submission_url = `https://codeforces.com/${(contest_id>codeforces_id_threshold)?"gym":"contest"}/${contest_id}/submission/${id}`;
					break;
				case vjudge_name:
					const runId = id;
					submission_url = `https://vjudge.net/solution/${runId}`;
					break;
				case leetcode_name:
					submission_url = `https://leetcode.com/submissions/detail/${id}`;
					break;
			}
			return submission_url;
		}

		async getCode(platform) {
			switch (platform.name) {
				case codeforces_name:
					await sleep(sleep_duration.codeforces_name);
					return cheerio.load((await axios.get(this.url, {proxy: await getRandomProxy()})).data)("#program-source-text").text();
				case vjudge_name:
					await sleep(sleep_duration.vjudge_name);
					return (await axios.get(`https://vjudge.net/solution/data/${this.id}`, {proxy: await getRandomProxy()})).data.codeAccessInfo; // FIXME: Take into account the actual text while logged in
					case leetcode_name:
						return this.code;
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
				case vjudge_name:
					url = "https://vjudge.net";
					break;
				case leetcode_name:
					url = "https://leetcode.com";
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
				case vjudge_name:
					maxUrlLength.problem = 50;
					maxUrlLength.submission = 40;
					break;
				case leetcode_name:
					maxUrlLength.problem = 100;
					maxUrlLength.submission = 50;
					break;
			}
			maxUrlLength.problem += extra; maxUrlLength.submission += extra;
			return maxUrlLength;
		}

		static generateLeetcodeHeaders(csrf_token) {
			const base_url = Platform.generateBaseUrl(leetcode_name);
			return {
				"content-type": "application/json",
				origin: base_url,
				refer: base_url,
				cookie: `LEETCODE_SESSION=${process.env.LEETCODE_SESSION || ''}; csrftoken=${csrf_token || ''}`,
				"x-csrfotken": csrf_token || '',
				"user-agent": "localhost",
			};
		}

		static async getCSRF(platform_name) {
			const baseUrl = Platform.generateBaseUrl(platform_name)
			const cookies_raw = await axios.get(baseUrl, {
				proxy: await getRandomProxy(),
				headers: {
					"content-type": "application/json",
					origin: baseUrl,
					refer: baseUrl,
					"user-agent": "localhost"
				}
			});
			return Platform.parseCookie(cookies_raw);
		}
		static parseCookie(cookies_raw, name="csrftoken") {
			const cookies = cookies_raw.headers["set-cookie"][0].split(';').map(cookie => cookie.split('='));
			return cookies.find(cookie => cookie[0].toLowerCase()===name)[1];
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
			if (verdict === "ok" || verdict === "accepted") return "accepted";
		}

		static cleanLanguage(language) {
			language = language.toLowerCase();

			if (language.includes("pypy")) return "PyPy";
			if (language.includes("python")) return "Python";

			if (language.includes("typescript")) return "TypeScript";
			if (language.includes("javascript")) return "JavaScript";
			if (language.includes("java")) return "Java";

			if (language.includes("pascal")) return "Pascal";
			if (language.includes("ruby")) return "Ruby";
			if (language.includes("rust")) return "Rust";
			if (language.includes("go")) return "Go";
			if (language.includes("php")) return "PHP";

			if (language.includes("c++") || language.includes("cpp")) return "C++";
			if (language.includes("c#")) return "C#";
			if (language.includes("c")) return "C";

			return language;
		}

		async fetchData() {
			let submissions = [];
			// fetch all submissions of the current platform then return only the submissions that have not been synced before
			const now = Math.floor((new Date()).getTime()/1000);
			switch (this.name) {
				case codeforces_name:
					const randomSig = Platform.generateRandomString(6);
					const fetchRequestParams = `user.status?apiKey=${process.env.CODEFORCES_KEY}&handle=${process.env.CODEFORCES_ID}&time=${now}`;
					submissions = await axios.get(`${this.base_url}/${fetchRequestParams}&apiSig=${randomSig}${crypto.createHash('sha512').update(`${randomSig}/${fetchRequestParams}#${process.env.CODEFORCES_SECRET}`).digest('hex')}`, {proxy: await getRandomProxy()});
					return (submissions.data.result).filter(submission => submission.creationTimeSeconds > this.last_submission_timestamp);
				case vjudge_name:
					submissions = [];
					let i = 0;
					while (true) {
						await sleep(sleep_duration.vjudge_name);
						let currentSubmissions = await axios.get(`${this.base_url}/status/data?start=${i*vjudge_max_results_length}&length=${vjudge_max_results_length}&un=${process.env.VJUDGE_ID}`, {proxy: await getRandomProxy()});
						if (currentSubmissions.data.data.length == 0) break;
						submissions.push(...currentSubmissions.data.data);
						i++;
					}
					return submissions.filter(submission => submission.time > this.last_submission_timestamp);
				case leetcode_name:
					let leetcode_headers = Platform.generateLeetcodeHeaders(await Platform.getCSRF(leetcode_name));
					let has_next = true;
					let offset = 0;
					while (has_next) {
						await sleep(sleep_duration.leetcode_name);
						const response = await axios(`${this.base_url}/api/submissions?offset=${offset}&limit=${leetcode_limit}`, {
							headers: leetcode_headers
						});
						submissions.push(...response.data.submissions_dump);
						has_next = response.data.has_next;
						offset += leetcode_limit;
						leetcode_headers = Platform.generateLeetcodeHeaders(Platform.parseCookie(response));
					}
					return submissions.filter(submission => submission.timestamp > this.last_submission_timestamp);
			}
		}

		async getProblem(data) {
			let id; let name; let difficulty = ""; let tags = [];
			switch (this.name) {
				case codeforces_name:
					id = `${data.problem.contestId}/${data.problem.index}`;
					name = `${data.problem.name}`;
					difficulty = `${data.problem.rating}`;
					for (let tag of data.problem.tags) tags.push({ "name": tag });
					break;
				case vjudge_name:
					id = `${data.oj}/${data.probNum}`;
					await sleep(sleep_duration.vjudge_name);
					name = await axios.get(`${this.base_url}/problem/data?start=0&length=1&OJId=${data.oj}&probNum=${data.probNum}&title=&source=&category=`, {proxy: await getRandomProxy()});
					name = name.data.data[0].title;
					break;
				case leetcode_name:
					id = `${data.question_id}/${data.title_slug}`;
					name = data.title;
					await sleep(sleep_duration.leetcode_name);
					const problem_info = await axios.post(`${this.base_url}/graphql`, {
						proxy: await getRandomProxy(),
						headers: Platform.generateLeetcodeHeaders(Platform.getCSRF(leetcode_name)),
						query: leetcode_query_get_problem,
						variables: { "titleSlug": data.title_slug }
					});
				difficulty = problem_info.data.data.question.difficulty;
				for (const tag of problem_info.data.data.question.topicTags) tags.push(tag.name.toLowerCase());
				break;
			}
			return new Problem(this, id, name, difficulty, tags);
		}

		cleanSubmissions(submissions_data, problems) {
			let submissions = [];
			let id; let verdict; let url; let timestamp; let language; let problem; let code = null;
			for (let i = 0; i < problems.length; i++) {
				const submission = submissions_data[i];
				problem = problems[i];
				switch (this.name) {
					case codeforces_name:
						id = submission.id;
						verdict = submission.verdict;
						timestamp = submission.creationTimeSeconds;
						language = submission.programmingLanguage;
						break;
					case vjudge_name:
						id = submission.runId;
						verdict = submission.status;
						timestamp = submission.time;
						language = submission.languageCanonical;
						break;
					case leetcode_name:
						id = submission.id;
						verdict = submission.status_display;
						timestamp = submission.timestamp;
						language = submission.lang;
						code = submission.code;
						break;
				}
				url = Submission.generateUrl(this, problem, id);

				submissions.push(new Submission(id, url, timestamp, verdict, language, problem, code));
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

		confirmCredentials(NOTION_DB) {
			const duration = 0; // COMBAK: Change back to 30
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
			await sleep(sleep_duration.notion);
			return await this.notion.pages.create(page_data);
		}

		async fetchEntries(platform) {

			const entries = {};
			let has_more = true;
			let next_cursor = undefined;
			while (has_more) {
				// Fetch the first batch of entries
				await sleep(sleep_duration.notion);
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
			await sleep(sleep_duration.notion);
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
			await sleep(sleep_duration.notion);
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
			await sleep(sleep_duration.notion);
			return await this.notion.blocks.children.append(data);
		}

		async updateDB(NOTION_DB, platform, submissions) {
			console.log(`\n\tFetching entries from ${NOTION_DB}...`);
			const entries = await this.fetchEntries(platform);
			console.log(`\tFetched entries from ${NOTION_DB}\n`);
			console.log(`\n\tProcessing Submissions...`);
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
					console.log(`\t\t\t[ACCEPTED] ${submission.language} solution for ${problem} `);
					// Get the code submission of the accepted solution
					const code = await submission.getCode(platform);
					await this.appendCodeBlock(entry.page_id, submission, code);
				}
				else {
					console.log(`\t\t\t[REJECTED] ${submission.language} solution for ${problem}`);
				}
			}
			console.log(`\tProcessed Submissions\n`)
		}

	}

	// Functions ====================================================================================

	function generateRandomNumber(max=1) {
		return Math.floor(Math.random()*max);
	}

	async function getRandomProxy(protocol="https") {
		const proxies = (await axios.get(`https://raw.githubusercontent.com/zloi-user/hideip.me/main/${protocol}.txt`)).data.split('\n');
		for (let i = 0; i < proxies.length; i++) proxies[i] = proxies[i].substring(0, proxies[i].lastIndexOf(':'));
		const proxy =  proxies[generateRandomNumber(proxies.length)];
		return {
			protocol: protocol,
			host: proxy.split(':')[0],
			port: Number(proxy.split(':')[1])
		};
	}

	async function randomWait() {
		return new Promise(resolve => setTimeout(resolve, generateRandomNumber(1001)));
	}

	async function sleep(duration) {
		randomWait();
		return new Promise(resolve => setTimeout(resolve, duration));
	}

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

		// for (let i = 0; i < 1000; i++) console.log(await getRandomProxy()); exitApplication(2); // TEMP:
		// for (let i = 0; i < 1000; i++) {const proxy = await getRandomProxy("https"); console.log(proxy); console.log((await axios.get("https://codeforces.com", {proxy: proxy})).status);} exitApplication(3); // TEMP:
		console.log((await axios.get("https://codeforces.com", {proxy: {protocol: "https", host: "8.213.128.90", port: 8080}}))); exitApplication(5); // TEMP:

		// Welcoming the user
		console.log("\n\n====================================================================================================\nWelcome to the Competitve Programming Problems Tracker in Notion\n====================================================================================================\n");

		// Initialize Notion
		console.log("\nDetecting Notion environment...")
		const notion = new Notion(process.env.NOTION_INTEGRATION_KEY, process.env.NOTION_DATABASE_ID);
		const NOTION_DB = await notion.getDB();
		console.log("Detected Notion environment\n")

		console.log(`\n${await notion.confirmCredentials(NOTION_DB)}\n`);

		// Initialize all supported platforms
		const codeforces = new Platform(codeforces_name, process.env.CODEFORCES_ID, Number(process.env.CODEFORCES_LAST_SUBMISSION_TIMESTAMP), process.env.CODEFORCES_KEY, process.env.CODEFORCES_SECRET);
		const leetcode = new Platform(leetcode_name, process.env.LEETCODE_ID, Number(process.env.LEETCODE_LAST_SUBMISSION_TIMESTAMP));
		const vjudge = new Platform(vjudge_name, process.env.VJUDGE_ID, Number(process.env.VJUDGE_LAST_SUBMISSION_TIMESTAMP));

		// Only add the platforms where the user has an id to the set
		const platforms = new Set();
		if (codeforces.user_id) platforms.add(codeforces);
		if (leetcode.user_id) platforms.add(leetcode);
		if (vjudge.user_id) platforms.add(vjudge);

		// Fetch submission from all supported platforms where the user has an id
		for (let platform of platforms) {
			// Get the submissions per platform
			console.log(`\nFetching ${platform} submissions...`);
			const submissions_data = await platform.fetchData();
			let problems = [];
			for (let data of submissions_data) {
				const problem = await platform.getProblem(data);
				console.log(`\tFetched from ${(problem.url).padEnd(platform.max_url_length.problem, " ")} ${problem}`);
				problems.push(problem);
			}
			console.log(`Fetched ${platform} submissions\n`);
			// Cleaning the submissions into a relevant format
			console.log(`\nFormatting ${platform} submissions...`);
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
		let data= `NOTION_INTEGRATION_KEY = ${process.env.NOTION_INTEGRATION_KEY}\nNOTION_DATABASE_ID = ${process.env.NOTION_DATABASE_ID}\n\nCODEFORCES_ID = ${process.env.CODEFORCES_ID}\nCODEFORCES_KEY = ${process.env.CODEFORCES_KEY}\nCODEFORCES_SECRET = ${process.env.CODEFORCES_SECRET}\nCODEFORCES_LAST_SUBMISSION_TIMESTAMP = ${codeforces.last_submission_timestamp}\n\nLEETCODE_ID = ${process.env.LEETCODE_ID}\nLEETCODE_SESSION = \nLEETCODE_LAST_SUBMISSION_TIMESTAMP = ${leetcode.last_submission_timestamp}\n\nVJUDGE_ID = ${process.env.VJUDGE_ID}\nVJUDGE_LAST_SUBMISSION_TIMESTAMP = ${vjudge.last_submission_timestamp}`;
		fs.writeFileSync(".env", data);
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
