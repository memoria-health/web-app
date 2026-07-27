// Stub for `@mediapipe/pose`.
//
// `@tensorflow-models/pose-detection` statically imports `{ Pose }` from
// `@mediapipe/pose` for its BlazePose detector — which we NEVER use (we run
// MoveNet only). The real `@mediapipe/pose` ships a non-ESM UMD script with no
// module exports, which breaks the Turbopack build. We alias the package to
// this stub in `next.config.ts`. Safe: the BlazePose code path is never invoked
// (we only ever call `createDetector(MoveNet, …)`).
export class Pose {}
