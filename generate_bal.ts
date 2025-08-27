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


const projectPath = "tests/ballerina";
getAllBalFiles(projectPath);