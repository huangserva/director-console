export const existingNarratedVideoRecipe = {
  id: "existing-narrated-video",
  name: "Existing Narrated Video",
  description: "Import a finished narrated video, derive captions and transcript, then package it into editable Hyperframes scenes.",
  inputRequirements: [
    {
      id: "source-video",
      type: "video",
      required: true,
      description: "Absolute path to a finished video with an audible narration track.",
    },
  ],
  optionalInputs: [
    { id: "theme-pack", type: "theme-pack", description: "Optional visual theme override." },
    { id: "existing-captions", type: "captions", description: "Optional captions to skip ASR in a later implementation." },
  ],
  stages: [
    {
      id: "probe",
      type: "probe",
      name: "Probe source media",
      outputs: ["media-metadata"],
    },
    {
      id: "asr",
      type: "asr",
      name: "Extract audio and transcribe",
      dependsOn: ["probe"],
      outputs: ["audio", "captions"],
    },
    {
      id: "transcript",
      type: "transcript",
      name: "Build transcript",
      dependsOn: ["asr"],
      outputs: ["transcript"],
    },
    {
      id: "scene-plan",
      type: "scene-plan",
      name: "Generate scene plan",
      dependsOn: ["transcript"],
      outputs: ["scene-plan"],
    },
    {
      id: "packaging",
      type: "packaging",
      name: "Build composer manifest",
      dependsOn: ["scene-plan"],
      outputs: ["manifest"],
    },
    {
      id: "compose",
      type: "compose",
      name: "Compose preview HTML",
      dependsOn: ["packaging"],
      outputs: ["html"],
    },
  ],
  defaultThemePackId: "text-only-hyperframes",
  recommendedComponents: ["TitleCard", "StepCard"],
  validationGates: ["probe.hasAudio", "captions.monotonic", "manifest.validate", "compose.exit0"],
};

export const digitalHumanTalkingHeadRecipe = {
  id: "digital-human-talking-head",
  name: "Digital Human Talking Head",
  description: "Generate a talking-head video from a script or topic, then package it into editable Hyperframes scenes.",
  inputRequirements: [
    {
      id: "presenter-video",
      type: "video",
      required: true,
      description: "Face/presenter source video for lip-sync generation.",
    },
    {
      id: "script-or-topic",
      type: "text",
      required: true,
      description: "Approved script or topic brief for narration.",
    },
  ],
  optionalInputs: [
    { id: "voice-profile", type: "voice", description: "Optional TTS voice profile." },
    { id: "theme-pack", type: "theme-pack", description: "Optional visual theme override." },
  ],
  stages: [
    {
      id: "script",
      type: "script",
      name: "Prepare script",
      outputs: ["script"],
    },
    {
      id: "tts",
      type: "tts",
      name: "Generate speech",
      dependsOn: ["script"],
      outputs: ["audio"],
    },
    {
      id: "lip-sync",
      type: "lip-sync",
      name: "Generate lip-synced presenter video",
      dependsOn: ["tts"],
      outputs: ["video"],
    },
    {
      id: "asr",
      type: "asr",
      name: "Generate captions",
      dependsOn: ["lip-sync"],
      outputs: ["captions"],
    },
    {
      id: "scene-plan",
      type: "scene-plan",
      name: "Generate scene plan",
      dependsOn: ["asr"],
      outputs: ["scene-plan"],
    },
    {
      id: "packaging",
      type: "packaging",
      name: "Build composer manifest",
      dependsOn: ["scene-plan"],
      outputs: ["manifest"],
    },
    {
      id: "compose",
      type: "compose",
      name: "Compose preview HTML",
      dependsOn: ["packaging"],
      outputs: ["html"],
    },
  ],
  defaultThemePackId: "digital-human-hyperframes",
  recommendedComponents: ["TitleCard", "StepCard", "ScreenWithPip", "SplitTextPresenter"],
  validationGates: ["script.approved", "tts.audioReady", "lip-sync.videoReady", "captions.monotonic", "manifest.validate", "compose.exit0"],
};

export const digitalHumanProductIntroRecipe = {
  id: "digital-human-product-introduction",
  name: "Digital Human Product Introduction",
  description: "Generate a digital-human product introduction from product inputs, presenter video, TTS, lip-sync, and product-oriented Hyperframes packaging.",
  inputRequirements: [
    {
      id: "presenter-video",
      type: "video",
      required: true,
      description: "Face/presenter source video for lip-sync generation.",
    },
    {
      id: "product-name",
      type: "text",
      required: true,
      description: "Product name shown in the opening promise and CTA.",
    },
    {
      id: "product-description",
      type: "text",
      required: true,
      description: "Short product description used for the highlight section.",
    },
    {
      id: "selling-points",
      type: "text-list",
      required: true,
      description: "Key selling points used for callout cards.",
    },
  ],
  optionalInputs: [
    { id: "product-media", type: "video-list", description: "Optional product proof/demo media used by ProofMontage." },
    { id: "offer-cta", type: "text", description: "Optional final offer or call to action." },
    { id: "voice-profile", type: "voice", description: "Optional TTS voice profile." },
    { id: "theme-pack", type: "theme-pack", description: "Optional visual theme override." },
  ],
  stages: [
    {
      id: "product-script",
      type: "script",
      name: "Prepare product introduction script",
      outputs: ["script"],
    },
    {
      id: "tts",
      type: "tts",
      name: "Generate speech",
      dependsOn: ["product-script"],
      outputs: ["audio"],
    },
    {
      id: "lip-sync",
      type: "lip-sync",
      name: "Generate lip-synced presenter video",
      dependsOn: ["tts"],
      outputs: ["video"],
    },
    {
      id: "asr",
      type: "asr",
      name: "Generate captions",
      dependsOn: ["lip-sync"],
      outputs: ["captions"],
    },
    {
      id: "scene-plan",
      type: "scene-plan",
      name: "Generate product scene plan",
      dependsOn: ["asr"],
      outputs: ["scene-plan"],
    },
    {
      id: "packaging",
      type: "packaging",
      name: "Build product composer manifest",
      dependsOn: ["scene-plan"],
      outputs: ["manifest"],
    },
    {
      id: "compose",
      type: "compose",
      name: "Compose preview HTML",
      dependsOn: ["packaging"],
      outputs: ["html"],
    },
  ],
  defaultThemePackId: "digital-human-product-hyperframes",
  recommendedComponents: ["StatsHero", "StepCard", "ProofMontage", "SummaryCta"],
  validationGates: ["product-script.ready", "tts.audioReady", "lip-sync.videoReady", "captions.monotonic", "manifest.validate", "compose.exit0"],
};

export const recipes = [existingNarratedVideoRecipe, digitalHumanTalkingHeadRecipe, digitalHumanProductIntroRecipe];
