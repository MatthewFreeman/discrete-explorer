# Publication checks

Repository content, branch names, commit metadata, pull requests, and published
artifacts must use English and neutral technical provenance. Keep local guidance,
machine paths, generated attribution, and private operational data out of releases.
Preserve upstream copyright and license notices.

Run before publishing:

```sh
node scripts/check-publication.cjs
```

Install the local check once per clone:

```sh
node scripts/check-publication.cjs --install-hook
```

The pre-push hook checks every outgoing commit reference, including its tracked
files and reachable commit metadata. It is installed in the common Git directory
and covers this clone's worktrees. Existing custom hooks are preserved; installation
stops if chaining them requires an explicit setup. Reinstall after updating the
checker. The GitHub workflow also checks pull request titles and bodies.

These checks prevent accidental publication through the checked paths. They do
not rewrite existing history, inspect remote comments or Actions archives, scan
compressed release packages, or enforce changes made through other clones or APIs.
Local hooks can be bypassed. Before a public release, review the actual archive
contents and remote metadata, including branch names, comments, Actions logs and
artifacts. Retain validation evidence and rollback copies during cleanup.
