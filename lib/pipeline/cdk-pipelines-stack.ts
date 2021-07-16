import { Construct, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import * as cp from '@aws-cdk/aws-codepipeline';
import * as cpa from '@aws-cdk/aws-codepipeline-actions';
import * as pipelines from '@aws-cdk/pipelines';
import { ServiceStage } from './service-stage';
import { EnvProps } from '../application/application_stack';

export interface ApplicationProps extends StackProps {
  apiResourceName: string
}

export class CdkPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id, props);

    const ResourceName = props.apiResourceName[0].toUpperCase() + props.apiResourceName.slice(1);

    const sourceArtifact = new cp.Artifact();
    const cloudAssemblyArtifact = new cp.Artifact();

    const sourceAction = new cpa.GitHubSourceAction({
      actionName: 'GitHub',
      output: sourceArtifact,
      oauthToken: SecretValue.secretsManager('github-pat-token'),
      branch: 'main',
      owner: 'bnvo92',
      repo: 'cdk-pipeline'
    });

    const synthAction = pipelines.SimpleSynthAction.standardNpmSynth({
      sourceArtifact,
      cloudAssemblyArtifact,
      installCommand: 'npm i -g npm && npm ci',
      buildCommand: 'npm run build && npm test',
      environment: {privileged: true}
    });

    const pipeline = new pipelines.CdkPipeline(this, `Pipeline`, {
      cloudAssemblyArtifact,
      sourceAction,
      synthAction
    });

    const devProps: EnvProps = {
      ...props,
      stageName: 'dev'
    }

    const devApp = new ServiceStage(this, `Dev${ResourceName}Api`, devProps);
    const devStage = pipeline.addApplicationStage(devApp);

    const devServiceUrl = pipeline.stackOutput(devApp.urlOutput);

    devStage.addActions(new pipelines.ShellScriptAction({
      actionName: 'IntegrationTests',
      runOrder: devStage.nextSequentialRunOrder(),
      additionalArtifacts: [
        sourceArtifact
      ],
      commands: [
        'npm i -g npm && npm ci',
        'npm run build',
        'npm run integration'
      ],
      useOutputs: {
        SERVICE_URL: devServiceUrl
      }
    }));

    const manualApprovalAction = new cpa.ManualApprovalAction({
      actionName: 'Manual-Approve-Push-to-Prod',
      notifyEmails: [
        'b.nvo92@gmail.com',
      ],
      additionalInformation: 'Manual approval action for - production stage',
      });

    const prodProps: EnvProps = {
      ...props,
      stageName: 'prod'
    }

    const prodApp = new ServiceStage(this, `Prod${ResourceName}Api`, prodProps);
    const prodStage = pipeline.addApplicationStage(prodApp);
    prodStage.addActions(manualApprovalAction);
  }
}