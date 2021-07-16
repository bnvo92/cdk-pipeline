  
import { CfnOutput, Construct, Stage } from '@aws-cdk/core';
import { ApplicationStack, EnvProps } from '../application/application_stack';

export class ServiceStage extends Stage {
  urlOutput: CfnOutput;
  EnvProps: EnvProps;

  constructor(scope: Construct, id: string, props: EnvProps) {
    super(scope, id, props);

    const service = new ApplicationStack(this, 'Stage', props);

    this.urlOutput = service.urlOutput
  }
}