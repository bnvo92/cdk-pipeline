import { Construct, Stack, StackProps, RemovalPolicy, Duration, CfnOutput} from '@aws-cdk/core';
import { RestApi, Deployment, Cors, Stage, EndpointType, SecurityPolicy, DomainName, Model, LambdaIntegration, IntegrationOptions} from '@aws-cdk/aws-apigateway';
import { lambdaFuncConstruct } from './constructs/lambda-construct'
import { DynamodbConstruct } from './constructs/dynamodb-construct'
import { ApplicationProps } from '../pipeline/cdk-pipelines-stack';

export interface EnvProps extends ApplicationProps {
  stageName: 'dev' | 'staging' | 'prod'
}

export class ApplicationStack extends Stack {
  urlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: EnvProps) {
    super(scope, id, props);

    const Api = new RestApi(this, `${props.stageName}RestApi`, {
      description: `${props.stageName} API`,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS
      }
    })

    const CorsResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    }
    const CorsMethodResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': true,
      'method.response.header.Access-Control-Allow-Headers': true
    }

    const MethodOptions = {
      methodResponses: [{ 
        statusCode: '200', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      },{
        statusCode: '400', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      }],
    }

    const requestTemplate = `#set($allParams = $input.params())
    {
      "body-json" : $input.json('$'),
      "params" : {
        #foreach($type in $allParams.keySet())
          #set($params = $allParams.get($type))
        "$type" : {
          #foreach($paramName in $params.keySet())
          "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
            #if($foreach.hasNext),#end
          #end
        }
          #if($foreach.hasNext),#end
        #end
      }
    }`

    const IntegrationOps = {
      proxy: false,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: CorsResponseParameters,
          responseModel: Model.EMPTY_MODEL,
          responseTemplates: {
            'application/json': ``
          },
        },{
          selectionPattern: '4\\d{2}',
          statusCode: '400',
          responseParameters: CorsResponseParameters,
          responseTemplates: {
            'application/json': `{
            "error": "Bad input!"
            }`
          },
        }
      ],
      requestTemplates: {
        'application/json': requestTemplate
      }
    }
    const methodOptionsPathParam = {
      methodResponses: [{ 
        statusCode: '200', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      },{
        statusCode: '400', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      }],
      requestParameters: {'method.request.path.userId': true}
    }

    const DynamodbTable = new DynamodbConstruct(this, 'dynamoConstruct', {
      stageName: props.stageName,
      apiResourceName: props.apiResourceName
    })

    const myLambdaEnvConfigs = {
      'DYNAMODB_TABLE_NAME': DynamodbTable.TableName,
    }

    const myResource = Api.root.addResource(`${props.apiResourceName}`)

    // create lambda
    const createLambdaFunction = new lambdaFuncConstruct(this, 'CreateLambda', {
      functionEntry: './lib/application/lambda-func',
      index: 'dynamodb_create',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })

    DynamodbTable.Table.grantReadWriteData(createLambdaFunction.LambdaFunc);
    const createLambdaIntegration = new LambdaIntegration(createLambdaFunction.LambdaAlias, IntegrationOps );
    const createFilters = myResource.addMethod('POST', createLambdaIntegration, MethodOptions);
    
    // list
    const listLambdaFunction = new lambdaFuncConstruct(this, 'ListLambda', {
      functionEntry: './lib/application/lambda-func',
      index: 'dynamodb_list',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(listLambdaFunction.LambdaFunc);
    const ListLambdaIntegration = new LambdaIntegration(listLambdaFunction.LambdaAlias, IntegrationOps );
    const listFilters = myResource.addMethod('GET', ListLambdaIntegration, MethodOptions);

    // get item
    const getLambdaFunction = new lambdaFuncConstruct(this, 'GetLambda', {
      functionEntry: './lib/application/lambda-func',
      index: 'dynamodb_get',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(getLambdaFunction.LambdaFunc);
    const getLambdaIntegration = new LambdaIntegration(getLambdaFunction.LambdaAlias, IntegrationOps );

    const filtersUserIdResource = myResource.addResource('{userId}')
    const getFilters = filtersUserIdResource.addMethod('GET', getLambdaIntegration, methodOptionsPathParam);

    // delete
    const deleteLambdaFunction = new lambdaFuncConstruct(this, 'DeleteLambda', {
      functionEntry: './lib/application/lambda-func',
      index: 'dynamodb_delete',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(deleteLambdaFunction.LambdaFunc);
    const deleteLambdaIntegration = new LambdaIntegration(deleteLambdaFunction.LambdaAlias, IntegrationOps );
    const deleteFilters = filtersUserIdResource.addMethod('DELETE', deleteLambdaIntegration, methodOptionsPathParam);

    // update
    const updateLambdaFunction = new lambdaFuncConstruct(this, 'UpdateLambda', {
      functionEntry: './lib/application/lambda-func',
      index: 'dynamodb_update',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })

    DynamodbTable.Table.grantReadWriteData(updateLambdaFunction.LambdaFunc);
    const updateLambdaIntegration = new LambdaIntegration(updateLambdaFunction.LambdaAlias, IntegrationOps );
    const updateFilters = filtersUserIdResource.addMethod('PATCH', updateLambdaIntegration, methodOptionsPathParam);
    
    this.urlOutput = new CfnOutput(this, 'RootURL', {
      value: `https://${Api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/`,
    });

  }
};
