import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as CdkPipelines from '../lib/pipeline/cdk-pipelines-stack';
import { ApplicationStack } from '../lib/application/application_stack'

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ApplicationStack(app, 'MyTestStack', {
      apiResourceName: 'test',
      stageName: 'dev'
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
