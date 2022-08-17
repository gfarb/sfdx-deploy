# Salesforce Deploy Action

Salesforce Deploy is a lightweight GitHub Action that allows you to quickly and safely automate your Salesforce build, test and deploy pipeline using GitHub Workflows.

Uses the Salesforce CLI to create a manifest from one or more local directories that contain source files by running the `force:source:convert` command and runs the `force:source:deploy` command to test in and deploy to a target environment.

Supports both pre and post destructive changes.

![](https://user-images.githubusercontent.com/22826414/185196841-8570dd5f-6560-465b-87ec-4df36f0d9f8d.gif)

## Usage

```yml
- uses: actions/sfdx-deploy
  env:
    # Username or alias for the target org. Must be pre-authorized.
    # Required
    TARGET_USERNAME: ""

    # Comma-separated list of paths to the local source files to include in the manifest.
    # Default value: force-app
    SOURCE_PATH: ""

    # Path to folder containing manifests (destructiveChangesPre.xml, destructiveChangesPost.xml)
    # of components to delete before and/or after the deploy.
    # Default value: destructive-changes
    DESTRUCTIVE_CHANGES: ""

    # Specifies which level of deployment tests to run.
    # Default value: RunLocalTests
    TEST_LEVEL: ""

    # Number of minutes to wait for the command to complete and display results to the terminal window.
    # Default value: 33
    WAIT: ""
```

## Outputs

- `DEPLOYED`: Boolean value that identifies if the deployment was successful.

## Example Workflow

```yml
on:
  push:
    branches:
      - "master"
name: Deploy to Salesforce Production
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "14"

      - name: Cache node modules
        uses: actions/cache@v3
        id: npm_cache_id
        with:
          path: node_modules
          key: ${{ runner.os }}-npm-cache-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-npm-cache-
            ${{ runner.os }}-

      - name: Install Dependencies
        if: steps.npm_cache_id.outputs.cache-hit != 'true'
        run: npm ci

      - name: SFDX Auth
        env:
          SFDX_JWT_KEY: ${{ secrets.SFDX_JWT_KEY }}
          SFDX_CLIENT_ID: ${{ secrets.SFDX_CLIENT_ID }}
        run: |
          echo "${SFDX_JWT_KEY}" > server.key
          npx sfdx force:auth:jwt:grant --clientid "${SFDX_CLIENT_ID}" --jwtkeyfile server.key --username gfarb@github.dreamforce --setdefaultdevhubusername
          npx sfdx force:org:display --json -u gfarb@github.dreamforce > sfdx-auth.json
          rm server.key

      - name: Build, Test & Deploy
        uses: gfarb/sfdx-deploy@v1
        env:
          TARGET_USERNAME: gfarb@github.dreamforce
          SOURCE_PATH: force-app
          DESTRUCTIVE_CHANGES: destructive-changes
          TEST_LEVEL: RunLocalTests
          WAIT: 200
```

## Resources

- [Deploying and Retrieving Salesforce Metadata](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/file_based.htm)
- [Deleting Components from an Organization](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy_deleting_files.htm)
- [`force:source:convert`](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm#cli_reference_force_source_convert)
- [`force:source:deploy `](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm#cli_reference_force_source_deploy)

## License

[MIT](LICENSE)
