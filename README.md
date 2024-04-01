# Competitive Programming Automated Problems Tracker in Notion

A simple application to track problems and submissions across different competitive programming platforms by syncing the data into a single Notion database.

## The Idea

As a competitive programmer, I tend to use a combination of different resources when training. Though I mainly use [Codeforces](https://codeforces.com/) and occasionally practice [Leetcode](https://leetcode.com/), I sometimes find myself wandering into other websites, including [VJudge](https://vjudge.net/) and [AtCoder](https://atcoder.jp/).

With the plethora of resources available, it has become somewhat of a tedious task to track my progress across all these different sites, especially when I want to refer back to a problem and can't remember exactly where I've come across it.

That is why I've decided to implement a CP Problem Tracker inside of my Notion workspace. It centralizes all the problems, successful submissions, and attempted languages.

## How it Works

This simple `node.js` application makes use of the available APIs for each entity.

The application first attempts to fetch and format all the user submissions, and their respective problems, from each platform's API. The application will only fetch _new_ submissions (_i.e._ submissions with a timestamp greater than the platform's `LAST_SUBMISSION_TIMESTAMP` of the `.env` file). The `LAST_SUBMISSION_TIMESTAMP` of each platform is initially set to zero and automatically updated after each _successful_ run.

Once the data is properly structured, the application uses Notion's API to update the respective database accordingly.

## Requirements

### A Notion Setup

Obviously, a Notion workspace is needed to sync to the corresponding database. If you do not already have a Notion account, check their official website at [https://www.notion.so/](https://www.notion.so/).

Once you've secured a workspace, you'll need a Notion database to sync to. The application expects certain properties with specific names and types, so feel free to duplicate this [database template](https://mahmoudj.notion.site/d3587ff389454bc6bccd62ee14ce0b1b?v=fc76100ca0db4772b14c3c640dd9a436&pvs=4).

**NOTE:** You CAN add properties to the duplicated database as you wish, but make sure not to alter any of the existing properties. Of course, feel free to edit the title, icon, and cover image as you please!

### Node.js

As this is a `Node.js` application, you'd need a node.js installation to run it. If you don't already have node.js installed, navigate to their website at [https://nodejs.org/](https://nodejs.org/).

### Your Identifiers

All your identifiers are stored in a local `.env` file next to `app.js` in the project's directory. These are your unique IDs which the application will use to properly identify you across the different paltforms.

_NOTE:_ Make sure your `.env` file is stored safely and up-to-date before running the application.

_NOTE:_ The `.env` file contains `LAST_SUBMISSION_TIMESTAMP` for each platform, which should be initialized to zero if the platform had not been synced before. It will update automatically after a successful run.

#### Constant Indentifiers

These are identifiers that you generate once and wouldn't typically need to change later on.

##### Notion

###### `NOTION_DATABASE_ID`: The ID of your duplicated Notion DB

Refer to [https://developers.notion.com/reference/retrieve-a-database](https://developers.notion.com/reference/retrieve-a-database) for the official documetation.

If you prefer to use the desktop app, you can navigate to your database and copy link (shortcut: CTRL+L) then follow the same described steps.

###### `NOTION_INTEGRATION_KEY`: The SECRET key used to communicate with Notion's API

Follow the steps described in the official documentation at [https://developers.notion.com/docs/create-a-notion-integration](https://developers.notion.com/docs/create-a-notion-integration) to generate your Notion key.

1. Navigate to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations) and select "New Integration".
2. Make sure the integration is "Internal" and fill out the basic information (Name and, optionally, Logo).
3. For the integrations, make sure to check "Read Content", "Update Content", and "Insert Content". No other capabilities are needed for the application to work. If interested, refer to the capabilities documentation at [https://developers.notion.com/reference/capabilities](https://developers.notion.com/reference/capabilities).

**_Important_:** Once you generate your key, you need to connect to your database. To do so:
1. Navigate to your database in Notion
2. Select the three dots on the top right and navigate to "Connections"
3. Select the integration you've just created

##### Codeforces

###### `CODEFORCES_ID`: Your codeforces handle

###### `CODEFORCES_KEY` & `CODEFORCES_SECRET` generated when you add a new API key from [https://codeforces.com/settings/api](https://codeforces.com/settings/api)

##### Leetcode

###### `LEETCODE_ID`: Your Leetcode username

##### VJudge

###### `VJUDGE_ID`: Your VJudge username

#### Variable Identifiers

##### Leetcode

###### `LEETCODE_SESSION`: Your current LEETCODE_SESSION cookie

Leetcode does not provide a way to generate API keys (like codeforces, for example) nor does it provide a seemless method of authenticating requests, which is why your LEETCODE_SESSION cookie is needed to authorize communication with Leetcode.

To generate this cookie:
1. Navigate to [https://leetcode.com/](https://leetcode.com/) and make sure you're signed in.
2. Open developer tools (_e.g._ CTRL+SHIFT+I on Google Chrome) and navigate to the Application tab where you'll search for LEETCODE_SESSION.
3. Copy the value of this cookie and paste it into the `.env` file.

**_Important_**: As this is a cookie, it is important to ensure that it is updated before each run.

## Using the Application

**Remember** to navigate to the project's directory in your terminal before executing any of these commands.

_If you're using the application for the first time_, run `npm install` to install or update all the required dependencies.

After you've updated the `.env` file with your identifiers as described in the previous section, run the command `node --env-file=.env app.js` in your terminal to start the sync process.

## Supported Features

- [x] Syncing your problems & submissions into Notion
- [ ] Downloading your submissions locally

### Supported Platforms

- [x] [Codeforces](https://codeforces.com/)
- [x] [Leetcode](https://leetcode.com/)
- [x] [VJudge](https://vjudge.net/)
- [ ] [AtCoder](https://atcoder.jp/)
- [ ] [CSES](https://cses.fi/)

## Known Issues

- Error handling is rather basic. This _is_ a simple application, after all. For the time being, a simple fix would be to clear the database and reset the `.env` timestamps back to `0`. This ensures a clean sync into an empty database.

- All languages supported by a platform are supported when syncing, but the formatting is still undergoing some testing.

### Codeforces

- Fetches private gym submissions' URL but does not sync their codes.
- Private submissions have an "undefined" difficulty

### Vjudge

- Fetches the submissions' URL but does not sync their codes (Needs authentication).

# References & Documentation

Following is a list of official documentation (if applicable) and any resources relevant to the project.

## [**Notion API**](https://developers.notion.com/) documentation

- [Request Limits](https://developers.notion.com/reference/request-limits): The rate limit for incoming requests per integration is an average of three requests per second. Some bursts beyond the average rate are allowed.

## [**Codeforces API**](https://codeforces.com/apiHelp) documentation

- [Request Limits](https://codeforces.com/apiHelp): API may be requested at most 1 time per two seconds. If you send more requests, you will receive a response with "FAILED" status and "Call limit exceeded" comment.

## **Leetcode API** documentation

Leetcode does not provide any official documentation, so following is a list of references that are directly relevant to the this project.

- The Submissions [REST API Endpoint](https://leetcode.com/api/submissions/)

- Leetcode's [GraphQL API Endpoint](https://leetcode.com/graphql)

- Query [Leetcode Problem by its Title (aka Slug)](https://github.com/JacobLinCool/LeetCode-Query/blob/main/src/graphql/problem.graphql)

## **Vjudge API** Documentation

Vjudge does not provide any official documentation, so following is a list of references that are directly relevant to the this project.

- Submissions Endpoint `https://vjudge.net/status/data?`params
- Problem Endpoint `https://vjudge.net/problem/data?`params
- Solution Endpoint `https://vjudge.net/solution/`run-id
