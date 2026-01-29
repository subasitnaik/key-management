/**
 * Vercel entry: must import express so Vercel detects Express app. Set "Root Directory" to backend in Vercel.
 */
import express from 'express';
import { createApp } from './src/app.js';

export default createApp();
