import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { orderMatcherRouter } from './routers/orderMatcher';
import errorMiddleware from './routers/errorMiddleware'

dotenv.config();

if (!process.env.PORT)
   process.exit(1);

const PORT: number = parseInt(process.env.PORT, 10);

const app = express();

// useful middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/matcher/order", orderMatcherRouter);
//simple error handler middleware
app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

