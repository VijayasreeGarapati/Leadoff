import { HumeClient } from "hume";
import { MongoClient } from "mongodb";
//import { writeFileSync } from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// MongoDB configuration
const mongoUri = "mongodb://localhost:27017";
const dbName = "Video";

// Initialize the Hume API client
const client = new HumeClient({
  apiKey: "QtM0o30ws0wKEciAebNfoNblGqnlKnEkwJXXxmi9H8owOqMG",
});

/**
 * Parses transcript text and returns a sorted list of { time, speaker } pairs.
 */
const parseTranscriptLines = (transcriptText: string): { time: number; speaker: string }[] =>
  transcriptText
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
      if (!match) return null;

      const [_, mm, ss, cs] = match;
      const timeInSeconds = +mm * 60 + +ss + +cs / 100;

      const afterTime = line.slice(match[0].length).trim();
      const speakerMatch = afterTime.match(/^([^:]+):/);
      const speaker = speakerMatch?.[1].trim() ?? "Unknown";

      return { time: timeInSeconds, speaker };
    })
    .filter(Boolean)
    .sort((a, b) => a!.time - b!.time) as { time: number; speaker: string }[];

/**
 * Finds the speaker closest in time to a given timestamp, within a given tolerance.
 */
const findSpeakerAtTime = (
  timeline: { time: number; speaker: string }[],
  targetTime: number,
  tolerance = 0.5
): string => {
  if (!timeline.length) return "Unknown";

  for (let i = 0; i < timeline.length; i++) {
    const curr = timeline[i];
    const next = timeline[i + 1];

    if (targetTime < curr.time) break;

    const inRange = !next || targetTime < next.time;
    const isClose = Math.abs(targetTime - curr.time) <= tolerance;

    if (inRange && isClose) return curr.speaker;
  }

  return "Unknown";
};

/**
 * Extracts top 5 emotions from Hume predictions, for each frame.
 */
const extractTop5Emotions = (
    data: any
  ): { frame: number; time: number; topEmotions: { name: string; score: number }[] }[] => {
    return (data ?? []).flatMap((item: any) =>
      (item?.results?.predictions ?? []).flatMap((pred: any) => {
        const faceModel = pred.models?.face;
        if (!faceModel) return [];
  
        return (faceModel.groupedPredictions ?? []).flatMap((group: any) =>
          (group.predictions ?? [])
            .filter((p: any) => Array.isArray(p.emotions))
            .map((p: any) => {
              const topEmotions = [...p.emotions]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
  
              return {
                frame: p.frame,
                time: p.time,
                topEmotions,
              };
            })
        );
      })
    );
  };

/**
 * Main execution:
 * - Fetches Hume predictions
 * - Loads transcript from MongoDB
 * - Maps emotions to speaker by timestamp
 * - Inserts single document into VideoFace
 */
async function main() {
  const jobId = "b2f547fc-1df9-4d5d-af20-139bfb26d0fb";
  const deal_id = "6716c58d3de2770db82ecbf9";

  const mongoClient = new MongoClient(mongoUri);

  try {
    // Step 1: Fetch Hume predictions
    const predictions = await client.expressionMeasurement.batch.getJobPredictions(jobId);

    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = path.dirname(__filename);


    // const outputPath = path.resolve(__dirname, `hume_predictions_${jobId}.json`);
    // writeFileSync(outputPath, JSON.stringify(predictions, null, 2), "utf-8");


    // Step 2: Connect to MongoDB and fetch transcript
    await mongoClient.connect();
    const db = mongoClient.db(dbName);

    const transcriptDoc = await db.collection("Transcripts").findOne({ deal_id});
    if (!transcriptDoc?.transcript) {
      throw new Error(`Transcript not found for deal_id: ${deal_id}`);
    }

    // Step 3: Parse speaker timeline and align predictions
    const speakerTimeline = parseTranscriptLines(transcriptDoc.transcript);
    const emotionFrames = extractTop5Emotions(predictions);

    const frames = emotionFrames.map(({ frame, time, topEmotions }) => ({
      frame,
      time,
      topEmotions,
      speaker: findSpeakerAtTime(speakerTimeline, time),
    }));

    // Step 4: Insert document into VideoFace
    const document = {
      deal_id,
      createdAt: new Date(),
      frameCount: frames.length,
      frames,
    };

    await db.collection("VideoFace").insertOne(document);
    console.log(`Inserted 1 document into VideoFace with ${frames.length} frames.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoClient.close();
  }
}

main();