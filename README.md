<style>
	img {
		display: inline-block;
		height: 32px;
		width: 32px;
		position: relative;
		transform: translateY(25%);
	}
</style>

# Competitive Programming Automated Problems Tracker in Notion

This is a simple web application used to sync, and consequently track, different problems across competitive programming platforms and store the data into a notion database.

## The Idea

## How it Works

The app reads a `.env` that contains all the necessary information for it to work, such as Notion's integration key and the user's codeforces handle.

The next stage waits for the user to confirm the detected workspaces and credentials.

Once the user confirms, the application starts the automated syncing process and updates the provided Notion database accordingly.
Logs would be presented on the screen to help the user track the operation's progress.

Once completed, the user will be prompted to save the updated `.env` with the more recent timestamps to be provided the next time the user wishes to sync his problems into Notion.

## Requirements

### A Notion Setup

### Your Usernames

### A Browser

- A browser
- A `.env` file containing the following:
	- `NOTION_INTEGRATION_KEY`
	- `NOTION_DATABASE_ID`
	- `{PLATFORM}_ID`
	- `{PLATFORM}_LAST_SUBMISSION_TIMESTAMP`

	**where:**
	- {PLATFORM} is the name of the platform (_e.g. CODEFORCES_))
	- The `PLATFORM_ID` is your username on the platform (_e.g. your codedforces handle_) or an empty string if you don't want to sync
	- `PLATFORM_LAST_SUBMISSION_ID` is the timestamp of the last synced submission. This is equal to zero for first-time runs.

	**Find below a sample `.env` file to upload)**
	```env
	NOTION_INTEGRATION_KEY = "notion_key"
	NOTION_DATABASE_ID = "notion_db_id"

	CODEFORCES_ID = "codeforces"
	CODEFORCES_LAST_SUBMISSION_TIMESTAMP = 0

	LEETCODE_ID = ""
	LEETCODE_LAST_SUBMISSION_TIMESTAMP = 0
	```

## Using the Application

1. Choose your `.env` file to upload.
2. Once your file is uploaded, the page will populate information to confirm your credentials. Please make sure of these before starting the sync process.
3. Just sit back and watch as the problems sync into your Notion database!
4. Save the newly generated `.env` with the updated timestamps. Upload this `.env` file the next time you use the application.

# References

Following is a list of resources used to complete this project:

## Documentation

- The [Notion API](https://developers.notion.com/) documentation
- The [Codeforces API](https://codeforces.com/apiHelp) documentation
- The [Leetcode API]() documentation

## Fonts

- [Playfair Display on Google Fonts](https://fonts.google.com/specimen/Playfair+Display?classification=Display)

## Color Palettes

- [Default coolor Palette on Flat UI Colors](https://flatuicolors.com/palette/defo)

## Images & Icons

- ![Favicon](./src/Images/Icons/favicon.png) Created by [juicy_fish on flaticon](https://www.flaticon.com/free-icons/api)

- ![GitHub icon](./src/Images/Icons/Platforms/github.png) Official [GitHub Logo](https://github.com/logos)

- ![Notion icon](./src/Images/Icons/Platforms/notion.ico) Official [Notion logo](https://codeforces.org/s/92769/favicon-96x96.png)

- ![Codeforces icon](./src/Images/Icons/Platforms/codeforces.png) Official [Codeforces logo](https://codeforces.org/s/99327/favicon-96x96.png)

- ![Leetcode icon](./src/Images/Icons/Platforms/leetcode.png) Official [Leetcode logo](https://assets.leetcode.com/static_assets/public/icons/favicon-96x96.png)
