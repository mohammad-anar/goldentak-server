import fs from 'fs';
import path from 'path';

const unlinkFile = (file: string) => {
  const filePath = path.join('uploads', file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

export default unlinkFile;


export const extractPathFromUrl = (url: string) => {
  const parsedUrl = new URL(url);
  return parsedUrl.pathname;
};
