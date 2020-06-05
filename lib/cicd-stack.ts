/**
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


import cdk = require('@aws-cdk/core')
import ssm = require('@aws-cdk/aws-ssm');
import lambda = require('@aws-cdk/aws-lambda');
import { Bucket } from '@aws-cdk/aws-s3'
import { CodeCommitPipeline } from './pipelines/codecommit-pipeline'
import PipelineRole from './iam/pipeline-role';

import { ProjectRepo, TriggerType } from '../config/config';

interface CicdStackProps extends cdk.StackProps {
  prefix: string,
  ssmRoot: string,
  repos: Array<ProjectRepo>
}

export class CicdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CicdStackProps) {
    super(scope, id, props)

    // Get S3 Bucket Name
    const artifactsBucketName = ssm.StringParameter.fromStringParameterName(this, 'artifactsBucketName', 
      `${props.ssmRoot}/buckets/cicdArtifactsBucketName`)
    const artifactsBucket = Bucket.fromBucketName(this, 'artifactsBucket', artifactsBucketName.stringValue)

    // Get Lambda email handler function
    const emailHandlerArn = ssm.StringParameter.fromStringParameterName(this, 'emailHandlerArn', 
      `${props.ssmRoot}/lambda/cicd-email-handler`)
    const emailHandler = lambda.Function.fromFunctionArn(this, 'emailHandler', emailHandlerArn.stringValue)

    // Get Lambda semver handler function
    const semverHandlerArn = ssm.StringParameter.fromStringParameterName(this, 'semverHandlerArn', 
      `${props.ssmRoot}/lambda/cicd-semver-handler`)
    const semverHandler = lambda.Function.fromFunctionArn(this, 'semverHandler', semverHandlerArn.stringValue)

    // Parse config.repos here to get module branch and owner
    for (let repo of props.repos){
      const pipelineName = `${props.prefix}-${repo.pipelineName}-${repo.branch}`.replace(/\/|_/g, '-')
      const modulePipelineRole = new PipelineRole(this, `${pipelineName}PipelineRole`)

      switch (repo.type) {
        case TriggerType.CodeCommit: {
            const repoName = repo.ccRepoName
            const repoOwner = repo.owner
            const repoBranch = repo.branch
            const cronTrigger = repo.cron
    
            new CodeCommitPipeline(this, `${pipelineName}-pipeline`, {
              artifactsBucket,
              prefix: props.prefix,
              ssmRoot: props.ssmRoot,
              repoOwner,
              repoName,
              repoBranch,
              cronTrigger,
              pipelineName,
              modulePipelineRole,
              emailHandler,
              semverHandler
            })
            break;
          }
      }
    }
  }
}
