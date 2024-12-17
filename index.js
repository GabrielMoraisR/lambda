const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const mysql = require("mysql2/promise");

const sqsClient = new SQSClient({ region: "us-east-1" });

function log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    data ? console.log(logMessage, JSON.stringify(data)) : console.log(logMessage);
}

async function getConnection() {
    log("INFO", "Conectando ao banco de dados...");
    try {
        log("DEBUG", "Criando conexão com os parâmetros fornecidos...");
        const connection = await mysql.createConnection({
            host: "host.docker.internal",
            port: "3306",
            user: "root",
            password: "1512",
            database: "Backoffice",
            connectTimeout: 10000
        });
        log("DEBUG", "Conexão criada com sucesso.");
        log("INFO", "Conexão com o banco de dados estabelecida.");
        return connection;
    } catch (error) {
        log("ERROR", "Erro ao conectar no banco de dados.", { error: error.message });
        throw error;
    }
}

async function queryDB(query, params) {
    log("INFO", "Executando consulta no banco de dados.", { query, params });
    const connection = await getConnection();
    try {
        const [results] = await connection.execute(query, params);
        log("INFO", "Consulta executada com sucesso.", { results });
        return results;
    } catch (error) {
        log("ERROR", "Erro ao executar consulta no banco de dados.", { error: error.message });
        throw error;
    } finally {
        await connection.end();
        log("INFO", "Conexão com o banco de dados encerrada.");
    }
}

async function sendMessage(queueUrl, messageBody) {
    log("INFO", "Enviando mensagem para o SQS.", { queueUrl });
    try {
        const params = {
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
        };

        const command = new SendMessageCommand(params);
        const response = await sqsClient.send(command);

        log("INFO", "Mensagem enviada com sucesso.", { response });
        return response;
    } catch (error) {
        log("ERROR", "Erro ao enviar mensagem para o SQS.", { error: error.message });
        throw error;
    }
}

exports.handler = async (event) => {
    log("INFO", "Processando evento recebido.");
    try {
        if (event.httpMethod) {
            log("INFO", "Evento vindo do API Gateway.");

            const body = event.body ? JSON.parse(event.body) : {};
            const queryField = body.queryField || event.queryStringParameters?.queryField;
            const queryValue = body.queryValue || event.queryStringParameters?.queryValue;

            if (!queryField || !queryValue) {
                log("ERROR", "Parâmetros de consulta ausentes.");
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: "Parâmetros de consulta ausentes." }),
                };
            }

            log("INFO", "Parâmetros de consulta obtidos.", { queryField, queryValue });

            const queryCheck = `SELECT COUNT(*) as count FROM tb_exame WHERE ${queryField} = ?`;
            const checkResult = await queryDB(queryCheck, [queryValue]);

            if (checkResult[0].count === 0) {
                log("ERROR", "Parâmetro não encontrado no banco de dados.");
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: "Parâmetro não encontrado no banco de dados." }),
                };
            }

            const queryExame = `SELECT * FROM tb_exame WHERE ${queryField} = ?`;
            const queryIntegracao = `SELECT * FROM tb_integracao WHERE ${queryField} = ?`;

            const responseExame = await queryDB(queryExame, [queryValue]);
            const responseIntegracao = await queryDB(queryIntegracao, [queryValue]);

            const response = {
                tb_exame: responseExame,
                tb_integracao: responseIntegracao,
            };

            log("INFO", "Consultas concluídas, preparando resposta.");
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Consultas realizadas.", data: response }),
            };
        } else if (event.Records) {
            log("INFO", "Evento vindo do SQS.");

            for (const record of event.Records) {
                const messageBody = JSON.parse(record.body);
                const queryField = messageBody.queryField;
                const queryValue = messageBody.queryValue;

                if (!queryField || !queryValue) {
                    log("ERROR", "Parâmetros de consulta ausentes.");
                    continue;
                }

                log("INFO", "Parâmetros para consulta.", { queryField, queryValue });

                const queryCheck = `SELECT COUNT(*) as count FROM tb_exame WHERE ${queryField} = ?`;
                const checkResult = await queryDB(queryCheck, [queryValue]);

                if (checkResult[0].count === 0) {
                    log("ERROR", "Parâmetro não encontrado no banco de dados.");
                    continue;
                }

                const queryExame = `SELECT * FROM tb_exame WHERE ${queryField} = ?`;
                const queryIntegracao = `SELECT * FROM tb_integracao WHERE ${queryField} = ?`;

                const responseExame = await queryDB(queryExame, [queryValue]);
                const responseIntegracao = await queryDB(queryIntegracao, [queryValue]);

                const response = {
                    tb_exame: responseExame,
                    tb_integracao: responseIntegracao,
                };

                const queueUrl = "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/MyQueue";
                await sendMessage(queueUrl, response);

                log("INFO", "Mensagem processada e enviada.");
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Mensagens do SQS processadas." }),
            };
        } else {
            log("WARN", "Evento desconhecido.");
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Evento inválido." }),
            };
        }
    } catch (error) {
        log("ERROR", "Erro no processamento do evento.", { error: error.message });
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Erro interno.", error: error.message }),
        };
    }
};
