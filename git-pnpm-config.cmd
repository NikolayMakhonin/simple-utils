@echo off
git config --global core.autocrlf input
echo Congratulations: Git Auto CRLF is disabled for all repositories on this computer

pnpm config set ignore-dep-scripts true
pnpm config set save-exact true
pnpm config set prefer-frozen-lockfile true
pnpm config set minimum-release-age 131760
pnpm config set trust-policy no-downgrade
echo Congratulations: Security settings for PNPM are configured for all repositories on this computer

pause
