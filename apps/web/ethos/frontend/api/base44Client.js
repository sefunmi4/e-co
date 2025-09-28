const notConfigured = async () => {
  throw new Error("Base44 SDK is not configured in this environment.");
};

export const base44 = {
  integrations: {
    Core: {
      InvokeLLM: notConfigured,
      SendEmail: notConfigured,
      UploadFile: notConfigured,
      GenerateImage: notConfigured,
      ExtractDataFromUploadedFile: notConfigured,
      CreateFileSignedUrl: notConfigured,
      UploadPrivateFile: notConfigured,
    },
  },
};
