import { Construct, Stack, StackProps, RemovalPolicy, Duration } from '@aws-cdk/core';
import * as path from 'path';
import { RestApi, Deployment, Cors, Stage, EndpointType, SecurityPolicy, DomainName, Model, LambdaIntegration, IntegrationOptions} from '@aws-cdk/aws-apigateway';
import { Function, Runtime, Code, Alias } from '@aws-cdk/aws-lambda';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { LambdaDeploymentConfig, LambdaDeploymentGroup } from '@aws-cdk/aws-codedeploy';

interface mylambdaProps extends StackProps {
    readonly functionEntry: string
    readonly lambdaEnvConfigs: Record<string,string>
    readonly index: string
    readonly integrationOptions: IntegrationOptions
  }
  
  export class lambdaFuncConstruct extends Construct {
  
    public readonly LambdaIntegration: LambdaIntegration
    public readonly LambdaAlias: Alias
    public readonly LambdaFunc: PythonFunction
  
    constructor(scope: Construct, id: string, props: mylambdaProps) {
      super(scope, id);
  
      const lambda_role = new Role(this, 'lambdaRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        description: 'This is a custom role for lambda',
      });
  
      // add custom lambda policies
      const lambda_policy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          // 'ec2:CreateNetworkInterface',
          // 'ec2:DescribeNetworkInterfaces',
          // 'ec2:DeleteNetworkInterface',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*']
      });
  
      lambda_role.addToPolicy(lambda_policy);
  
      // python https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-python-readme.html
      const myLambdaFunction = new PythonFunction(this, 'MyGetFunction', {
        runtime: Runtime.PYTHON_3_8,
        index: 'handler.py',
        handler: props.index,
        entry: props.functionEntry,
        environment : props.lambdaEnvConfigs,
        role: lambda_role,
        timeout: Duration.seconds(30)
      });
  
      const handlerAlias = new Alias(this, 'alias', {
        aliasName: 'Current',
        version: myLambdaFunction.currentVersion
      });
  
      new LambdaDeploymentGroup(this, 'DeploymentGroup' , {
        alias: handlerAlias,
        deploymentConfig: LambdaDeploymentConfig.ALL_AT_ONCE,
      });
  
      const HandlerLambdaintegration = new LambdaIntegration(handlerAlias, props.integrationOptions );
  
      this.LambdaIntegration = HandlerLambdaintegration
      this.LambdaAlias = handlerAlias
      this.LambdaFunc = myLambdaFunction
  
    }
  };
  