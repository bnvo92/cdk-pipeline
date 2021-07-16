import { Construct, Stack, StackProps, RemovalPolicy, Duration } from '@aws-cdk/core';
import * as path from 'path';
import { RestApi, Deployment, Cors, Stage, EndpointType, SecurityPolicy, DomainName, Model, LambdaIntegration, IntegrationOptions} from '@aws-cdk/aws-apigateway';
import { Function, Runtime, Code, Alias } from '@aws-cdk/aws-lambda';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { LambdaDeploymentConfig, LambdaDeploymentGroup } from '@aws-cdk/aws-codedeploy';

interface dynamodbProps extends StackProps {
    apiResourceName: string
    stageName: 'prod'|'staging'|'dev'
}

export class DynamodbConstruct extends Construct {
  public readonly TableName: string
  public readonly Table: Table
  public readonly DynamodbRole: Role

  constructor(scope: Construct, id: string, props: dynamodbProps) {
    super(scope, id);

    const dynamodbTableName = `${props.stageName}${props.apiResourceName}Table`
    
    const DynamodbTable = new Table(this, `${dynamodbTableName}`, {
      partitionKey: { 
        name: `${props.apiResourceName}Id`,
        type: AttributeType.STRING
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: `${dynamodbTableName}`
    });

    const dynamoPolicy = new Policy(this, 'dynamoPolicy', {
      statements: [
        new PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem'
          ],
          effect: Effect.ALLOW,
          resources: [DynamodbTable.tableArn],
        }),
      ],
    });

    const dynamoRole = new Role(this, 'dynamoRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    dynamoRole.attachInlinePolicy(dynamoPolicy);

    this.TableName = dynamodbTableName
    this.Table = DynamodbTable
    this.DynamodbRole = dynamoRole
  }
};
