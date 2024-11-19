import os
import re
import requests
import datetime
from urllib.parse import urlparse, urlunparse

markdown_folder = os.environ.get("MARKDOWN_DIR", os.path.join(os.getcwd(), "output"))
image_folder = os.path.join(markdown_folder, "images")
if not os.path.exists(markdown_folder):
    print("MARKDOWN_DIR not set, and not exist %s" % markdown_folder)
    exit()
if not os.path.exists(image_folder):
    os.mkdir(image_folder)


download_image = os.environ.get("DOWNLOAD_IMAGE", "True")
download_image = download_image.lower() == "true"

update_image_url = os.environ.get("UPDATE_MDIMG_URL", "False")
update_image_url = update_image_url.lower() == "true"

replace_image_host = os.environ.get("REPLACE_IMAGE_HOST", "")

# 初始化正则表达式用于匹配图片标签
img_tag_pattern = r'!\[.*?\]\((.*?)\)'

# 遍历文件夹中的所有 Markdown 文件
for root, dirs, files in os.walk(markdown_folder):
    for file in files:
        if file.endswith(".md"):
            md_file = os.path.join(root, file)
            # print(md_file)

            # 读取 Markdown 文件内容
            with open(md_file, "r", encoding="utf-8") as f:
                markdown_content = f.read()

            # 使用正则表达式查找所有图片链接
            img_links = re.findall(img_tag_pattern, markdown_content)
            replace_image_url = False
            for img_link in img_links:
                # print(img_link)
                parsed_url = urlparse(img_link)
                if not parsed_url.scheme:
                    continue
                img_filename = re.search(r'/([^/]+\.(png|jpg|jpeg|gif|svg))$', parsed_url.path)
                if img_filename:
                    img_filename = img_filename.group(1)
                else:
                    continue

                path_parts = parsed_url.path.split('/')
                LATEX_PATTERN = r'/yuque/__latex/([^/]+\.svg)$'
                # print(parsed_url.path)
                if re.match(LATEX_PATTERN, parsed_url.path):
                    years = str(datetime.datetime.now().year)
                elif len(path_parts) > 3:
                    years = path_parts[3]
                    print(path_parts)
                    if not re.match(r'^2\d{3}$', years):
                        print(f"[Warning]: The markdown {file} file's image URL {parsed_url.path} format in markdown does not match the Yuque URL that we expect. There may be a problem with the parsing and the image won't be downloaded. Please pay attention.")                        
                        continue
                else:
                    years = str(datetime.datetime.now().year)

                if download_image:
                    download_folder = os.path.join(image_folder, years)
                    if not os.path.exists(download_folder):
                        os.mkdir(download_folder)

                    img_url = urlunparse(parsed_url._replace(fragment=""))
                    response = requests.get(img_url)
                    if response.status_code == 200:
                        with open(os.path.join(download_folder, img_filename), "wb") as img_file:
                            img_file.write(response.content)
                            print(f"Downloaded: {img_filename}")
                
                if update_image_url: 
                    if not replace_image_host.strip():
                        relative_path = os.path.relpath(image_folder, root).replace("\\", "/")
                        new_img_link = f'{relative_path}/{years}/{img_filename}'
                    else:
                        replace_image_host = replace_image_host.rstrip("/")
                        new_img_link = f'{replace_image_host}/{years}/{img_filename}'
                    markdown_content = markdown_content.replace(img_link, new_img_link)
                    replace_image_url = True

            # 保存修改后的Markdown文件
            if replace_image_url:
                print(md_file)
                with open(md_file, "w", encoding="utf-8") as f:
                    f.write(markdown_content)

print("Image link replacement complete.")

