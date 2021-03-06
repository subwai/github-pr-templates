.PHONY: zip

version = `cat manifest.json | jq -r '.version'`

all: zip

zip:
	mkdir -p dist
	git archive --worktree-attributes HEAD -o dist/github-pr-templates.$(version).zip

%:
	@: