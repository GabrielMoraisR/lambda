# Configuração e Utilização do LocalStack no Docker Desktop

Foi realizada a instalação da extensão do LocalStack no Docker Desktop. Também é possível fazer a instalação via **docker-compose**, limitando os serviços que serão utilizados.

Após a instalação e com o Docker em execução, podemos acessar uma versão web clicando na extensão e no botão **LocalStack Web Application**.

No LocalStack Instances, você encontra todas as funcionalidades disponíveis na versão gratuita. Ao clicar em qualquer uma delas, o serviço correspondente será iniciado automaticamente.

Você pode configurar os serviços de duas formas:
1. Pela **interface web**.
2. Pela **linha de comando**.

A seguir, irei mostrar a configuração do serviço **Lambda** usando a interface web.

---

## Configurando o Serviço Lambda pela Interface Web

1. Clique no serviço **Lambda**.
2. Encontre o botão **Create** e clique nele.
3. Preencha os campos obrigatórios:
   - **Package Type**: Tipo de pacote. Use **Zip** para arquivos `.zip` ou **Image** para imagens de contêiner.
   - **Function Name**: Nome da função. Por exemplo, `MyLambdaFunction`.
   - **Runtime**: Versão da linguagem em execução. Exemplo: `nodejs18.x`.
   - **Role**: ARN da função de execução. Exemplo: `arn:aws:iam::000000000000:role/execution_role`.

4. Verifique o campo **Handler**. O padrão é `handler.handler`, mas pode ser necessário ajustá-lo para algo como `index.handler`, dependendo da estrutura do seu código.

5. Em **Code Source**, selecione o tipo de arquivo:
   - Para subir um arquivo `.zip`, escolha **Upload ZIP File**.
   - Arraste o arquivo ou clique para selecionar o arquivo.

---

## Criando o Serviço SQS pela Linha de Comando

Como a tarefa exige o uso do **SQS** junto com o **Lambda**, a configuração do SQS será feita via linha de comando.

### Acessando o Container
- Pelo Docker Desktop:
  - Clique no container do LocalStack.
  - Use a opção **Exec** para acessar o terminal.
- Pelo terminal:
  - Execute `docker ps` para listar os containers.
  - Acesse o container com: `docker exec -it <ID DO CONTAINER> bash`.

### Criando a Fila SQS
1. Crie a fila com:
   ```bash
   awslocal sqs create-queue --queue-name MyQueue
   ```
   Substitua `MyQueue` pelo nome da sua fila. 

2. Se o retorno for algo como:
   ```json
   {
       "QueueUrl": "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/MyQueue"
   }
   ```
   a criação foi bem-sucedida.

3. Liste as filas com:
   ```bash
   awslocal sqs list-queues
   ```

---

## Integrando o Lambda com o SQS

1. Adicione permissão para que o Lambda interaja com o SQS:
   ```bash
   awslocal lambda add-permission \
       --function-name MyLambdaFunction \
       --statement-id sqs-event \
       --action lambda:InvokeFunction \
       --principal sqs.amazonaws.com \
       --source-arn arn:aws:sqs:us-east-1:000000000000:MyQueue
   ```

2. Mapeie o evento:
   ```bash
   awslocal lambda create-event-source-mapping \
       --function-name MyLambdaFunction \
       --event-source-arn arn:aws:sqs:us-east-1:000000000000:MyQueue
   ```

---

## Criando Logs no CloudWatch

1. Crie o grupo de logs:
   ```bash
   awslocal logs create-log-group --log-group-name /aws/lambda/MyLambdaFunction
   ```
2. Liste os grupos de logs:
   ```bash
   awslocal logs describe-log-groups
   ```

---

## Testando a Fila SQS

Envie uma mensagem para a fila (O body irá variar de acordo com o seu projeto):
```bash
awslocal sqs send-message \
    --queue-url http://localhost:4566/000000000000/MyQueue \
    --message-body '{"queryField": "id", "queryValue": "1"}'
```

Se o retorno for algo como:
```json
{
    "MD5OfMessageBody": "699f6305f69986d697317b5eb09034fc",
    "MessageId": "0964fd23-28cc-42c9-9222-0e287f67d409"
}
```
o envio foi bem-sucedido.

---

## Comandos Adicionais

### Limpar a Fila SQS
```bash
awslocal sqs purge-queue --queue-url <URL DA FILA>
```

### Atualizar a Função Lambda
- Aumentar a memória em MB:
  ```bash
  awslocal lambda update-function-configuration \
      --function-name MyLambdaFunction \
      --memory-size 256
  ```
- Aumentar o timeout:
  ```bash
  awslocal lambda update-function-configuration \
      --function-name MyLambdaFunction \
      --timeout 10
  ```