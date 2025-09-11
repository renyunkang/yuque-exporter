import fs from 'fs';
import { Readable } from 'stream';
import { type } from './const.js';
import jsonstream from 'jsonstream';

class BookPage {
    constructor(id, uuid, name, url, type, parent_uuid, child_uuid, sibling_uuid) {
        this.id = id;
        this.uuid = uuid;
        this.name = name;
        this.url = url;
        this.type = type;
        this.parent_uuid = parent_uuid;
        this.child_uuid = child_uuid;
        this.sibling_uuid = sibling_uuid;
    }
}


class Book {
    root
    user_url
    constructor(id, name, slug) {
      this.id = id;
      this.name = name;
      this.slug = slug
    }
}

export async function getAllBooks(page) {
    const books = [];
    const response = await page.goto('https://www.yuque.com/api/mine/book_stacks', { waitUntil: 'networkidle0' });
    const data = await response.text();
    
    // Debug: Log the raw response
    console.log('API Response Status:', response.status());
    console.log('API Response Length:', data.length);
    
    // If we get a 401, it's definitely an auth issue
    if (response.status() === 401) {
        console.error('❌ 401 Unauthorized - Authentication failed!');
        console.log('Response data:', data);
        console.error('Your cookies may have expired. Try deleting cookies.json and running with USER/PASSWORD again.');
        return books;
    }
    
    // Check if response looks like JSON
    if (data.startsWith('<') || data.includes('<!DOCTYPE')) {
        console.error('❌ Received HTML instead of JSON - possible authentication issue');
        console.log('Response preview:', data.substring(0, 200) + '...');
        return books;
    }
    
    try {
        // Try to parse as JSON first to check structure
        const jsonData = JSON.parse(data);
        console.log('JSON Structure:', Object.keys(jsonData));
        if (jsonData.data) {
            console.log('Data array length:', jsonData.data.length);
        }
    } catch (e) {
        console.error('❌ Failed to parse JSON:', e.message);
        return books;
    }
    
    const parser = jsonstream.parse('data.*');
    
    const bookData = await new Promise((resolve) => {
        const parsedBooks = [];
        parser.on('data', (object) => {
            console.log('Parsed object:', Object.keys(object));
            if (object.books) {
                console.log('Books in object:', object.books.length);
            }
            parsedBooks.push(object);
        });
        parser.on('end', () => {
            resolve(parsedBooks);
        });
        parser.end(data);
    });

    console.log('Total book data objects:', bookData.length);

    for (const object of bookData) {
        if (object.books && object.books.length > 0) {
            console.log(`Processing ${object.books.length} books from object`);
            for (let i = 0; i < object.books.length; i++) {
                const book = new Book(object.books[i].id, delNonStdChars(object.books[i].name), object.books[i].slug);
                book.root = await getBookDetail(page, book);
                book.user_url = object.books[i].user.login
                books.push(book);
            }
        } else {
            console.log('Object has no books or empty books array');
        }
    }

    console.log(`Books count is: ${books.length}`);
    return books;
}

// async function getBookDetail(page, book) {
//     const url = 'https://www.yuque.com/api/catalog_nodes?book_id=' + book.id;
//     const response = await page.goto(url, { waitUntil: 'networkidle0' });
//     const data = await response.text();
//     const parser = jsonstream.parse('data.*');

//     const bookData = await new Promise((resolve) => {
//         var uuidMap = new Map();
//         let firstSubItem;

//         parser.on('data', (object) => {
//             if (firstSubItem === undefined && object.parent_uuid === "") {
//                 firstSubItem = object;
//             }
//             const bookPage = new BookPage(object.id, object.uuid, delNonStdChars(object.title),
//                 object.url, object.type, object.parent_uuid, object.child_uuid, object.sibling_uuid);
//             uuidMap.set(object.uuid, bookPage);
//         });

//         parser.on('end', () => {
//             resolve({ firstSubItem, uuidMap });
//         });
//         parser.end(data);
//     });

//     const { firstSubItem, uuidMap } = bookData;
//     const root = { name: delNonStdChars(book.name), type: type.Book, object: book };
//     if (firstSubItem) {
//         buildDirectoryTree(uuidMap, firstSubItem.uuid, root);
//         printDirectoryTree(root);
//     }

//     return root;
// }

async function getBookDetail(page, book) {
    return new Promise(async (resolve, reject) => {
        var uuidMap = new Map();
        let fristSubItem;
        var url = 'https://www.yuque.com/api/catalog_nodes?book_id=' + book.id;
        var response = await page.goto(url, { waitUntil: 'networkidle0' });
        var data = await response.text();
        var parser = jsonstream.parse('data.*');

        parser.on('data', (object) => {
            if (fristSubItem === undefined && object.parent_uuid === "") {
                fristSubItem = object;
            }
            const bookPage = new BookPage(object.id, object.uuid, delNonStdChars(object.title),
                object.url, object.type, object.parent_uuid, object.child_uuid, object.sibling_uuid);
            uuidMap.set(object.uuid, bookPage);
        });

        parser.on('end', () => {
            // 创建一个目录树的根节点
            const root = { name: delNonStdChars(book.name), type: type.Book, object: book };
            if (fristSubItem) {
                buildDirectoryTree(uuidMap, fristSubItem.uuid, root);
                printDirectoryTree(root);
            } 
            resolve(root); 
        
        });

        parser.end(data);
    });
}
  


function buildDirectoryTree(uuidMap, uuid, node) {
    const item = uuidMap.get(uuid);
    if (!item) return;

    // 在当前节点下创建子节点
    const childNode = { name: item.name, type: item.type, object: item };
    if (item.child_uuid) {
        if (item.type === type.Document) {
            childNode.type = type.TitleDoc;
        }
        buildDirectoryTree(uuidMap, item.child_uuid, childNode);
    }

    if (item.sibling_uuid) {
        buildDirectoryTree(uuidMap, item.sibling_uuid, node);
    }

    // 将子节点添加到当前节点
    if (!node.children) {
        node.children = [];
    }
    node.children.push(childNode);
}


// 打印目录树函数
export function printDirectoryTree(node, indent = 0) {
    const indentation = '  '.repeat(indent);
    if (node.type === type.Book) {
        console.log();
        console.log(indentation + node.name + "/" + node.object.slug);
    } else {
        console.log(indentation + node.name + "/" + node.object.url);
    }

    if (node.children) {
        node.children.forEach(childNode => {
            printDirectoryTree(childNode, indent + 1);
        });
    }
}

function delNonStdChars(str) {
    return str.replace(/\//g, "_").
        replace(/"/g, '_').
        replace(/:/g, '_').
        replace(/\?/g, '_').
        replace(/[\\/:\*\?"<>\|]/g, '').
        trim();
}
