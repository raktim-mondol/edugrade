const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const AdmZip = require('adm-zip');

/**
 * Process a code file and extract its contents
 * @param {string} filePath - Path to the code file
 * @param {string} fileExtension - Extension of the file
 * @returns {Promise<string>} - The extracted code text
 */
async function processCodeFile(filePath, fileExtension) {
  try {
    // Handle file based on type
    switch (fileExtension.toLowerCase()) {
      case '.zip':
        return await processZipFile(filePath);
      case '.ipynb':
        return await processJupyterNotebook(filePath);
      case '.py':
      case '.js':
      case '.java':
      case '.html':
      case '.css':
      case '.c':
      case '.cpp':
      case '.h':
      case '.ts':
      case '.jsx':
      case '.tsx':
      case '.php':
      case '.rb':
      case '.sh':
      case '.swift':
      case '.go':
      case '.rs':
      case '.cs':
      case '.json':
      case '.xml':
      case '.md':
      case '.txt':
        // For regular text-based code files, just read the file
        return await fs.readFile(filePath, 'utf8');
      default:
        return `Unsupported file type: ${fileExtension}`;
    }
  } catch (error) {
    console.error(`Error processing code file ${filePath}:`, error);
    throw new Error(`Failed to process code file: ${error.message}`);
  }
}

/**
 * Process a Jupyter Notebook file
 * @param {string} filePath - Path to the Jupyter notebook file
 * @returns {Promise<string>} - Extracted code and markdown cells
 */
async function processJupyterNotebook(filePath) {
  try {
    // Read the notebook file
    const notebookContent = await fs.readFile(filePath, 'utf8');
    const notebook = JSON.parse(notebookContent);
    
    if (!notebook.cells) {
      return 'Invalid Jupyter notebook format';
    }
    
    // Extract code and markdown from cells
    let processedContent = `# Jupyter Notebook: ${path.basename(filePath)}\n\n`;
    
    for (let i = 0; i < notebook.cells.length; i++) {
      const cell = notebook.cells[i];
      
      if (cell.cell_type === 'markdown') {
        processedContent += `## Markdown Cell ${i + 1}\n`;
        processedContent += cell.source.join('') + '\n\n';
      } 
      else if (cell.cell_type === 'code') {
        processedContent += `## Code Cell ${i + 1}\n`;
        processedContent += '```python\n';
        processedContent += cell.source.join('');
        processedContent += '\n```\n\n';
        
        // Include output if available (for completed notebooks)
        if (cell.outputs && cell.outputs.length > 0) {
          processedContent += 'Output:\n';
          
          for (const output of cell.outputs) {
            if (output.output_type === 'stream') {
              processedContent += '```\n' + output.text.join('') + '\n```\n';
            } 
            else if (output.output_type === 'execute_result' && output.data && output.data['text/plain']) {
              processedContent += '```\n' + output.data['text/plain'].join('') + '\n```\n';
            }
            // Skip image outputs and other complex data
          }
          processedContent += '\n';
        }
      }
    }
    
    return processedContent;
    
  } catch (error) {
    console.error(`Error processing Jupyter notebook ${filePath}:`, error);
    return `Failed to process Jupyter notebook: ${error.message}`;
  }
}

/**
 * Process a ZIP file containing code
 * @param {string} filePath - Path to the ZIP file
 * @returns {Promise<string>} - Extracted code files content
 */
async function processZipFile(filePath) {
  try {
    // Create a temporary directory to extract files
    const tempDir = path.join(path.dirname(filePath), `temp_extract_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Extract the ZIP file
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
    
    // Process extracted files
    const extractedContent = await processDirectory(tempDir);
    
    // Clean up temporary directory
    try {
      await deleteDirectory(tempDir);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary directory:', cleanupError);
    }
    
    return extractedContent;
    
  } catch (error) {
    console.error(`Error processing ZIP file ${filePath}:`, error);
    return `Failed to process ZIP file: ${error.message}`;
  }
}

/**
 * Process a directory recursively to extract code files
 * @param {string} dirPath - Path to the directory
 * @param {number} [maxFilesToProcess=50] - Maximum number of files to process
 * @param {number} [maxBytesPerFile=100000] - Maximum bytes to read per file
 * @param {string} [prefix=''] - Prefix for directory path in output
 * @returns {Promise<string>} - Concatenated content of code files
 */
async function processDirectory(dirPath, maxFilesToProcess = 50, maxBytesPerFile = 100000, prefix = '') {
  try {
    const items = await fs.readdir(dirPath);
    let result = '';
    let filesProcessed = 0;
    
    // Define file extensions to process
    const codeExtensions = [
      '.py', '.js', '.ts', '.java', '.html', '.css', '.c', '.cpp', '.h',
      '.jsx', '.tsx', '.php', '.rb', '.go', '.rs', '.cs', '.swift', 
      '.ipynb', '.json', '.xml', '.md', '.txt'
    ];
    
    // Define directories and files to ignore
    const ignorePatterns = [
      'node_modules', '__pycache__', '.git', '.venv', 'venv', 'env',
      '.DS_Store', 'package-lock.json', '.vscode', '.idea'
    ];
    
    for (const item of items) {
      // Skip ignored patterns
      if (ignorePatterns.some(pattern => item.includes(pattern))) {
        continue;
      }
      
      const itemPath = path.join(dirPath, item);
      const itemStat = await fs.stat(itemPath);
      
      if (itemStat.isDirectory()) {
        // Process subdirectory recursively
        const subdirContent = await processDirectory(
          itemPath,
          maxFilesToProcess - filesProcessed,
          maxBytesPerFile,
          `${prefix}${item}/`
        );
        
        result += subdirContent;
        filesProcessed += subdirContent.split('# File:').length - 1;
      } 
      else if (itemStat.isFile()) {
        // Check if we've reached the file limit
        if (filesProcessed >= maxFilesToProcess) {
          result += '# Maximum file limit reached. Some files were not processed.\n\n';
          break;
        }
        
        // Process file only if it has a code extension
        const ext = path.extname(item).toLowerCase();
        if (codeExtensions.includes(ext)) {
          try {
            // Read only a portion of the file if it's too large
            const fileSize = itemStat.size;
            const fileContent = await fs.readFile(
              itemPath, 
              'utf8', 
              { length: Math.min(fileSize, maxBytesPerFile) }
            );
            
            result += `# File: ${prefix}${item}\n`;
            result += fileContent;
            
            if (fileSize > maxBytesPerFile) {
              result += '\n# ... (file truncated due to size) ...\n';
            }
            
            result += '\n\n';
            filesProcessed++;
          } catch (fileError) {
            result += `# Error reading file ${prefix}${item}: ${fileError.message}\n\n`;
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
    return `# Failed to process directory ${prefix || dirPath}: ${error.message}\n\n`;
  }
}

/**
 * Delete a directory and all its contents recursively
 * @param {string} dirPath - Path to the directory to delete
 */
async function deleteDirectory(dirPath) {
  try {
    // Use different approach based on OS
    if (process.platform === 'win32') {
      // Windows-specific solution
      await exec(`rmdir /s /q "${dirPath}"`);
    } else {
      // Unix-like OS solution
      await exec(`rm -rf "${dirPath}"`);
    }
  } catch (error) {
    console.error(`Failed to delete directory ${dirPath}:`, error);
    throw error;
  }
}

module.exports = {
  processCodeFile,
  processJupyterNotebook,
  processZipFile,
  processDirectory
};