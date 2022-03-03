import { NextFunction, Request, Response } from 'express';

function errorMiddleware(error: Error, request: Request, response: Response, next: NextFunction) {
    const status: number = 500;
    const errorMessage = error.message;
    console.log(errorMessage);
    response.status(status).send({
      status,
      message: errorMessage,
    });
}

export default errorMiddleware;