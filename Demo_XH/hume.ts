import { HumeClient } from "hume";

const client = new HumeClient({
  apiKey: "QtM0o30ws0wKEciAebNfoNblGqnlKnEkwJXXxmi9H8owOqMG",
});

async function startHumeInference(): Promise<string> {
  const response = await client.expressionMeasurement.batch.startInferenceJob({
    urls: [
      "https://leadoff-video.s3.us-west-1.amazonaws.com/66d7fe03-ee6d-4a21-8d55-84723956167f",
    ],
    notify: true,
  });

  console.log("Hume Job Started. Response:");
  console.dir(response, { depth: null });

  if (!response.jobId) {
    throw new Error("No jobId returned from startInferenceJob");
  }

  return response.jobId;
}

async function getHumePredictions(jobId: string) {
  const predictions = await client.expressionMeasurement.batch.getJobPredictions(
    jobId
  );
  return predictions;
}

async function main() {
  try {
    //const jobId = await startHumeInference();

    const jobId= 'b2f547fc-1df9-4d5d-af20-139bfb26d0fb'

    const predictions = await getHumePredictions(jobId);

    console.log("Predictions:");
    console.dir(predictions, { depth: null });
  } catch (error) {
    console.error("Error:", error);
  }
}

main();