document.addEventListener("DOMContentLoaded", () => {

	// Defining Classes =============================================================================

	class platform {
		constructor(platform_name="", user_id = "", submission_timestamp = 0) {
			this.platform_name = platform_name; // name of the competitive programming platform
			this.user_id = user_id; // username or handle used to uniquely identify an account on the platform
			this.submission_timestamp = submission_timestamp; // the last submission id after which to filter the query results
		}
	};

	// Detecting Notion Entities ====================================================================
	function detectNotionWorkspace(key) {
		const NOTION_USER_URL = "https://api.notion.com/v1/users";
	}
	function detectNotionDatabase() {

	}

	// Clearing the page (i.e. Start Fresh) =========================================================
	function clearPage() {
		const uploadFileText = document.querySelector("#env-upload > p");
		if (uploadFileText != null) uploadFileText.remove();
		document.querySelectorAll(".to-hide").forEach((div) => {
			if (!div.classList.contains("hidden")) div.classList.add("hidden");
		})
	}

	// Defining Universal Constants =================================================================

	const envUpload = document.getElementById("env-upload");
	const envConfirm = document.getElementById("env-confirm");
	const logs = document.getElementById("logs");
	const envUpdate = document.getElementById("env-update");

	/* ==============================================================================================
	Start Running
	============================================================================================== */
	const inputFile = document.getElementById("env-input");

	inputFile.addEventListener("change", () => {

		clearPage();

		// @ts-ignore: inputFile has the .files attribute
		const uploadFile = inputFile.files[0];

		const uploadMsg = document.createElement("p");
		uploadMsg.innerText = `${uploadFile.name}`;
		envUpload.append(uploadMsg);

		const reader = new FileReader();
		reader.onload = function() {

			// Extracting Provided Credentials ==========================================================
			// @ts-ignore: buffered reader works
			const credentials = JSON.parse(reader.result);

			const NOTION_INTEGRATION_KEY = credentials.NOTION.INTEGRATION_KEY;
			const NOTION_DATABASE_ID = credentials.NOTION.DATABASE_ID;

			const codeforces = new platform("codeforces", credentials.CODEFORCES.USER, credentials.CODEFORCES.LAST_SUBMISSION_TIMESTAMP);
			const leetcode = new platform("leetcode", credentials.LEETCODE.USER, credentials.LEETCODE.LAST_SUBMISSION_TIMESTAMP);

			// @ts-ignore
			const notion = axios.create({
				baseURL: "https://api.notion.com/v1",
				headers: {
					// Handling CORS
					"Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Max-Age, Access-Control-Allow-Methods, Content-Type, Authorization, Notion-Version",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Credentials": "true",
					"Access-Control-Max-Age": "1800",
					"Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST,PUT",
					// Authorizing the Request
					"Content-Type": "application/json",
					"Authorization": `Bearer ${NOTION_INTEGRATION_KEY}`,
					"Notion-Version": "2022-06-28"
				}
			});

			const platforms = new Set([codeforces, leetcode]);

			// Prompt the user to confirm the extracted credentials =====================================
			confirmCreds(notion, NOTION_DATABASE_ID, platforms);

		}
		reader.readAsText(uploadFile);

	});

	function confirmCreds(notion, NOTION_DATABASE_ID, platforms) {

		// @ts-ignore: axios is imported in index.html
		/*
		notion.get('/users/me')
		.then((data) => {

			console.log(data);

			// const notion_workspace = detectNotionWorkspace(NOTION_INTEGRATION_KEY);
			// const notion_database = detectNotionDatabase();

			envConfirm.classList.remove("hidden");

		})
		*/

		axios.get("https://codeforces.com/api/user.status?handle=MahmoudJ").then(data => console.log(data));

	}

})
