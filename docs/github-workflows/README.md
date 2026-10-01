# GitHub Actions workflows

`ci.yml` is stored here because the farm OAuth token lacks the `workflow` scope required to push into `.github/workflows/`.

## Install (human or token with `workflow` scope)

```bash
mkdir -p .github/workflows
cp docs/github-workflows/ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push
```

Or: `gh auth refresh -s workflow` then move the file under `.github/workflows/` in a follow-up PR.
