import winston from 'winston';

const { combine, timestamp, errors, json } = winston.format;

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: []
    })
  ]
});
