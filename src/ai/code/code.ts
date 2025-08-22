import { generateText } from "ai";
import { ANTHROPIC_SONNET_3_5, getAnthropicClinet } from "../connection";
import { anthropic } from "@ai-sdk/anthropic";

const { text } = await generateText({
    model: anthropic(getAnthropicClinet(ANTHROPIC_SONNET_3_5)),
    prompt: 'Do you know about ballerina lang'
})

console.log(text);