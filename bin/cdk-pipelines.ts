#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkPipelineStack, ApplicationProps } from '../lib/pipeline/cdk-pipelines-stack';

const myprops: ApplicationProps = {
    apiResourceName: 'User',
}

const app = new cdk.App();
new CdkPipelineStack(app, 'CdkPipelinesStack', myprops);
