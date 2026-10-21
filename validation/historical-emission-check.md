# Historical emission validation

This is retained evidence of an earlier successful workflow, not a new CI result.

- Repository: MatthewFreeman/discrete-explorer
- Run: [33348624117](https://github.com/MatthewFreeman/discrete-explorer/actions/runs/33348624117)
- Source revision: `bb7e06822985e17007969784ea6800e1554665b4`
- Started: 2026-08-31T01:46:49Z
- Recorded conclusion: success
- Original log archive SHA-256: `fb774853daaad491267739743dd702a9ecc1faffa9d65e68e5a9b5c3a2137be1`

Reference labels and hosted-runner paths in the log below are normalized for
publication. Timestamps, source revisions, commands, and test outcomes remain
available. The original run and job records are retained. The original log archive
is preserved separately for rollback and comparison.

```text
﻿2026-08-31T01:46:53.7787014Z Current runner version: '2.336.0'
2026-08-31T01:46:53.7812242Z ##[group]Runner Image Provisioner
2026-08-31T01:46:53.7813130Z Hosted Compute Agent
2026-08-31T01:46:53.7813724Z Version: 20260819.586
2026-08-31T01:46:53.7814554Z Commit: 3cc4a88dfa507ef76119ad1bb3eccc6378bb2b76
2026-08-31T01:46:53.7815324Z Build Date: 2026-08-18T23:20:18Z
2026-08-31T01:46:53.7816047Z Worker ID: {92a10c24-bbd3-46a2-b387-b2a4e3bc1e94}
2026-08-31T01:46:53.7816783Z Azure Region: westus
2026-08-31T01:46:53.7817398Z ##[endgroup]
2026-08-31T01:46:53.7819357Z ##[group]Operating System
2026-08-31T01:46:53.7820041Z Ubuntu
2026-08-31T01:46:53.7820548Z 24.04.4
2026-08-31T01:46:53.7821170Z LTS
2026-08-31T01:46:53.7821693Z ##[endgroup]
2026-08-31T01:46:53.7822335Z ##[group]Runner Image
2026-08-31T01:46:53.7823013Z Image: ubuntu-24.04
2026-08-31T01:46:53.7823625Z Version: 20260823.283.1
2026-08-31T01:46:53.7824992Z Included Software: https://github.com/actions/runner-images/blob/ubuntu24/20260823.283/images/ubuntu/Ubuntu2404-Readme.md
2026-08-31T01:46:53.7826663Z Image Release: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20260823.283
2026-08-31T01:46:53.7827684Z ##[endgroup]
2026-08-31T01:46:53.7829228Z ##[group]GITHUB_TOKEN Permissions
2026-08-31T01:46:53.7831191Z Contents: read
2026-08-31T01:46:53.7832191Z Metadata: read
2026-08-31T01:46:53.7832893Z ##[endgroup]
2026-08-31T01:46:53.7834984Z Secret source: Actions
2026-08-31T01:46:53.7836151Z Prepare workflow directory
2026-08-31T01:46:53.8179957Z Prepare all required actions
2026-08-31T01:46:53.8230933Z Getting action download info
2026-08-31T01:46:54.1768033Z Download action repository 'actions/checkout@v4' (SHA:11d5960a326750d5838078e36cf38b85af677262)
2026-08-31T01:46:54.3064562Z Download action repository 'actions/setup-node@v4' (SHA:49933ea5288caeca8642d1e84afbd3f7d6820020)
2026-08-31T01:46:54.5003624Z Complete job name: verify
2026-08-31T01:46:54.5836975Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-08-31T01:46:54.5845948Z ##[group]Run actions/checkout@v4
2026-08-31T01:46:54.5846708Z with:
2026-08-31T01:46:54.5847232Z   repository: MatthewFreeman/discrete-explorer
2026-08-31T01:46:54.5852132Z   token: ***
2026-08-31T01:46:54.5852628Z   ssh-strict: true
2026-08-31T01:46:54.5853086Z   ssh-user: git
2026-08-31T01:46:54.5853550Z   persist-credentials: true
2026-08-31T01:46:54.5854051Z   clean: true
2026-08-31T01:46:54.5854508Z   sparse-checkout-cone-mode: true
2026-08-31T01:46:54.5855061Z   fetch-depth: 1
2026-08-31T01:46:54.5855507Z   fetch-tags: false
2026-08-31T01:46:54.5855963Z   show-progress: true
2026-08-31T01:46:54.5856417Z   lfs: false
2026-08-31T01:46:54.5856880Z   submodules: false
2026-08-31T01:46:54.5857340Z   set-safe-directory: true
2026-08-31T01:46:54.5857845Z   allow-unsafe-pr-checkout: false
2026-08-31T01:46:54.5858915Z ##[endgroup]
2026-08-31T01:46:54.6894766Z Syncing repository: MatthewFreeman/discrete-explorer
2026-08-31T01:46:54.6897504Z ##[group]Getting Git version info
2026-08-31T01:46:54.6899068Z Working directory is '[runner-home]/work/discrete-explorer/discrete-explorer'
2026-08-31T01:46:54.6900884Z [command]/usr/bin/git version
2026-08-31T01:46:54.7011359Z git version 2.55.0
2026-08-31T01:46:54.7022815Z ##[endgroup]
2026-08-31T01:46:54.7047667Z Temporarily overriding HOME='[runner-home]/work/_temp/caedd4c6-2303-4bba-8331-bd7c47eebc9f' before making global git config changes
2026-08-31T01:46:54.7050195Z Adding repository directory to the temporary git global config as a safe directory
2026-08-31T01:46:54.7053997Z [command]/usr/bin/git config --global --add safe.directory [runner-home]/work/discrete-explorer/discrete-explorer
2026-08-31T01:46:54.7113386Z Deleting the contents of '[runner-home]/work/discrete-explorer/discrete-explorer'
2026-08-31T01:46:54.7119158Z ##[group]Initializing the repository
2026-08-31T01:46:54.7124337Z [command]/usr/bin/git init [runner-home]/work/discrete-explorer/discrete-explorer
2026-08-31T01:46:54.7234223Z hint: Using 'master' as the name for the initial branch. This default branch name
2026-08-31T01:46:54.7237899Z hint: will change to "main" in Git 3.0. To configure the initial branch name
2026-08-31T01:46:54.7239604Z hint: to use in all of your new repositories, which will suppress this warning,
2026-08-31T01:46:54.7240884Z hint: call:
2026-08-31T01:46:54.7241552Z hint:
2026-08-31T01:46:54.7242384Z hint: 	git config --global init.defaultBranch <name>
2026-08-31T01:46:54.7243387Z hint:
2026-08-31T01:46:54.7244291Z hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
2026-08-31T01:46:54.7245850Z hint: 'development'. The just-created branch can be renamed via this command:
2026-08-31T01:46:54.7247213Z hint:
2026-08-31T01:46:54.7247934Z hint: 	git branch -m <name>
2026-08-31T01:46:54.7249075Z hint:
2026-08-31T01:46:54.7250163Z hint: Disable this message with "git config set advice.defaultBranchName false"
2026-08-31T01:46:54.7252534Z Initialized empty Git repository in [runner-home]/work/discrete-explorer/discrete-explorer/.git/
2026-08-31T01:46:54.7255165Z [command]/usr/bin/git remote add origin https://github.com/MatthewFreeman/discrete-explorer
2026-08-31T01:46:54.7302381Z ##[endgroup]
2026-08-31T01:46:54.7303571Z ##[group]Disabling automatic garbage collection
2026-08-31T01:46:54.7309577Z [command]/usr/bin/git config --local gc.auto 0
2026-08-31T01:46:54.7345576Z ##[endgroup]
2026-08-31T01:46:54.7346949Z ##[group]Setting up auth
2026-08-31T01:46:54.7354345Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-08-31T01:46:54.7389695Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-08-31T01:46:54.7817932Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-08-31T01:46:54.7859647Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-08-31T01:46:54.8091244Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-08-31T01:46:54.8130907Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-08-31T01:46:54.8370935Z [command]/usr/bin/git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***
2026-08-31T01:46:54.8413497Z ##[endgroup]
2026-08-31T01:46:54.8415090Z ##[group]Fetching the repository
2026-08-31T01:46:54.8425752Z [command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +bb7e06822985e17007969784ea6800e1554665b4:refs/remotes/origin/[historical-reference]/emission-nav-label
2026-08-31T01:46:55.4980033Z From https://github.com/MatthewFreeman/discrete-explorer
2026-08-31T01:46:55.4981984Z  * [new ref]         bb7e06822985e17007969784ea6800e1554665b4 -> origin/[historical-reference]/emission-nav-label
2026-08-31T01:46:55.4986579Z ##[endgroup]
2026-08-31T01:46:55.4988236Z ##[group]Determining the checkout info
2026-08-31T01:46:55.4990215Z ##[endgroup]
2026-08-31T01:46:55.4992330Z [command]/usr/bin/git sparse-checkout disable
2026-08-31T01:46:55.5050637Z [command]/usr/bin/git config --local --unset-all extensions.worktreeConfig
2026-08-31T01:46:55.5087835Z ##[group]Checking out the ref
2026-08-31T01:46:55.5093656Z [command]/usr/bin/git checkout --progress --force -B [historical-reference]/emission-nav-label refs/remotes/origin/[historical-reference]/emission-nav-label
2026-08-31T01:46:55.5319139Z Switched to a new branch '[historical-reference]/emission-nav-label'
2026-08-31T01:46:55.5322046Z branch '[historical-reference]/emission-nav-label' set up to track 'origin/[historical-reference]/emission-nav-label'.
2026-08-31T01:46:55.5328197Z ##[endgroup]
2026-08-31T01:46:55.5374698Z [command]/usr/bin/git log -1 --format=%H
2026-08-31T01:46:55.5402518Z bb7e06822985e17007969784ea6800e1554665b4
2026-08-31T01:46:55.5791126Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-08-31T01:46:55.5797951Z ##[group]Run actions/setup-node@v4
2026-08-31T01:46:55.5799639Z with:
2026-08-31T01:46:55.5800842Z   node-version: 24
2026-08-31T01:46:55.5802180Z   always-auth: false
2026-08-31T01:46:55.5803284Z   check-latest: false
2026-08-31T01:46:55.5813852Z   token: ***
2026-08-31T01:46:55.5814809Z ##[endgroup]
2026-08-31T01:46:55.7292384Z Found in cache @ /opt/hostedtoolcache/node/24.19.0/x64
2026-08-31T01:46:55.7296856Z (node:2204) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
2026-08-31T01:46:55.7300662Z (Use `node --trace-deprecation ...` to show where the warning was created)
2026-08-31T01:46:55.7303363Z ##[group]Environment details
2026-08-31T01:46:56.1789204Z node: v24.19.0
2026-08-31T01:46:56.1790538Z npm: 11.17.0
2026-08-31T01:46:56.1790848Z yarn: 1.22.22
2026-08-31T01:46:56.1791793Z ##[endgroup]
2026-08-31T01:46:56.1926225Z ##[group]Run node --test tests/*.cjs
2026-08-31T01:46:56.1926710Z [36;1mnode --test tests/*.cjs[0m
2026-08-31T01:46:56.1981241Z shell: /usr/bin/bash -e {0}
2026-08-31T01:46:56.1981658Z ##[endgroup]
2026-08-31T01:46:56.3271332Z ✔ exposes Emission as a dedicated same-origin explorer tab (3.226256ms)
2026-08-31T01:46:56.3273065Z ✔ ships a self-contained official-domain emission export (1.338641ms)
2026-08-31T01:46:56.3274388Z ✔ anchors Today to the live Discrete chain tip (5.473314ms)
2026-08-31T01:46:56.3275697Z ✔ ships desktop and mobile selected-value callouts (0.610831ms)
2026-08-31T01:46:56.3277169Z ✔ binds every emission artifact to the reviewed source commit (9.113753ms)
2026-08-31T01:46:56.3278910Z ✔ preserves the reviewed 120-month CSV artifact (0.341758ms)
2026-08-31T01:46:56.3372874Z ℹ tests 6
2026-08-31T01:46:56.3373600Z ℹ suites 0
2026-08-31T01:46:56.3374312Z ℹ pass 6
2026-08-31T01:46:56.3376392Z ℹ fail 0
2026-08-31T01:46:56.3376960Z ℹ cancelled 0
2026-08-31T01:46:56.3377471Z ℹ skipped 0
2026-08-31T01:46:56.3377816Z ℹ todo 0
2026-08-31T01:46:56.3378203Z ℹ duration_ms 89.915494
2026-08-31T01:46:56.3547347Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-08-31T01:46:56.3549140Z Post job cleanup.
2026-08-31T01:46:56.4781178Z (node:2249) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
2026-08-31T01:46:56.4782811Z (Use `node --trace-deprecation ...` to show where the warning was created)
2026-08-31T01:46:56.5057457Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-08-31T01:46:56.5060014Z Post job cleanup.
2026-08-31T01:46:56.5951694Z [command]/usr/bin/git version
2026-08-31T01:46:56.6009312Z git version 2.55.0
2026-08-31T01:46:56.6044345Z Temporarily overriding HOME='[runner-home]/work/_temp/c3a78603-8915-4333-83ae-ec11f9a7a3fc' before making global git config changes
2026-08-31T01:46:56.6046935Z Adding repository directory to the temporary git global config as a safe directory
2026-08-31T01:46:56.6051794Z [command]/usr/bin/git config --global --add safe.directory [runner-home]/work/discrete-explorer/discrete-explorer
2026-08-31T01:46:56.6092070Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-08-31T01:46:56.6128193Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-08-31T01:46:56.6388168Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-08-31T01:46:56.6410521Z http.https://github.com/.extraheader
2026-08-31T01:46:56.6423685Z [command]/usr/bin/git config --local --unset-all http.https://github.com/.extraheader
2026-08-31T01:46:56.6460444Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-08-31T01:46:56.6773326Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-08-31T01:46:56.6824352Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-08-31T01:46:56.7217638Z Cleaning up orphan processes
2026-08-31T01:46:56.7588192Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
```
