import express, { Request, Response } from "express";
import {Order} from '../entities/order';

export const orderMatcherRouter = express.Router();

orderMatcherRouter.post("/", async (req: Request, res: Response) => {
    const order: Order = req.body;
    const matchedPrice = { matchedPrice: getRandom(10, 20).toFixed(2) };
    console.log('Received order: ', order, '\n', matchedPrice);
    res.status(200).send(matchedPrice);
  });

  const getRandom = (min: number, max: number) => Math.random() * (max - min) + min;