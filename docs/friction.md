when a request is aborted i get this
 response.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  the metrics log all shows 0 maybe becuse groq send it at the end of the response
  my question whe the signal is aborted i thought it throw erro why is the code after the loop is bing excuted


  2.for timeout i was expecting to see 504 server erro code but instead it gives 
  reaming content...
app-1  | {"event":"llm_request","model":"openai/gpt-oss-20b","input_tokens":73,"output_tokens":1938,"total_tokens":2011,"latency_ms":2764.59,"input_cost":0.00000548,"output_cost":0.0005814,"total_cost":0.00058688,"tokens_per_second":701.01}



D4. 8/27
groq has a quta limik of 8k so 50k char test failed