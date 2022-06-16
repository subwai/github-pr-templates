.PHONY: zip test

version = `cat manifest.json | jq -r '.version'`

all: zip

zip:
	mkdir -p dist
	zip -r dist/github-pr-templates.$(version).zip . -x .github/\* .git/\* .gitignore .idea/\* dist/\* Makefile

%:
	@: