import * as fs from 'fs';
import path from 'path';

function getAllBalFiles(dirpath: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dirpath);

    files.forEach((file) => {
        const filePath = path.join(dirpath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            getAllBalFiles(filePath, fileList);
        } else if (file.endsWith('.bal')) {
            fileList.push(filePath)
        }
    });

    console.log(fileList)
    return fileList;
}

function chunkText(text: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];

    let start = 0;

    while (start < text.length) {
        const end = start + chunkSize;
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

function readAndChunksFiles(filePaths: string[]) {

    const allChunks: { file: string; chunkIndex: number; content: string }[] = [];

    filePaths.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const chunks = chunkText(content);

        chunks.forEach((chunk, index) => {
            allChunks.push({
                file: filePath,
                chunkIndex: index,
                content: chunk,
            });
        });
    });

    console.log(allChunks);
    return allChunks;

}


const projectPath = "tests/ballerina";
const balFiles = getAllBalFiles(projectPath);
const fileChunks = readAndChunksFiles(balFiles);
