import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { orderMatcherRouter } from './routers/orderMatcher';
import { uncaughtErrorHandler } from './middlewares/uncaughtErrorHandler'

dotenv.config();

const port = (!process.env.port ? 3244 : parseInt(process.env.port, 10));// 3244 is the default port.

const app = express();

// useful middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/matcher/order", orderMatcherRouter);
// error handler middlewares
app.use(uncaughtErrorHandler);


app.listen(port, () => {
    console.log(`Market data services listening on port ${port}`);
});