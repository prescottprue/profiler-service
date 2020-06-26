# Profiler Service

> Profiler service for Firebase Real Time Database. Runs in App Engine and sends output to Stackdriver and Cloud Storage

## Run Locally

1. Generate a service account which has Google Cloud Storage access and save as `serviceAccount.json`
1. Create an `.env.local` file with the following values:

    ```bash
    PROFILING_PROJECT="<- name of the project you want to profile ->"
    FIREBASE_TOKEN="<- CI token from firebase login:ci ->"
    GCLOUD_BUCKET="<- name of bucket to upload results to ->"
    ```

1. Run `yarn dev`

## Deploy

**Before Starting**: Make sure you have the `gcloud` command line tool installed

1. Set up gcloud cli to project: `gcloud config set project my-project`
1. Generate a service account which has Google Cloud Storage access and save as `serviceAccount.json`
1. Create `env_variables.yaml` which looks like so:

    ```yaml
    env_variables:
      PROFILING_PROJECT: '<- name of the project you want to profile ->'
      FIREBASE_TOKEN: '<- CI token from firebase login:ci ->'
      # Defaults to ${project_id}.appspot.com with id loaded from serviceAccount.json
      GCLOUD_BUCKET: '<- name of the project you want to profile ->'
    ```

    **NOTE**: Account which is used to generate `FIREBASE_TOKEN` must have access to profiling project

1. Deploy using `gcloud app deploy`