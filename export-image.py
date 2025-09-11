import os
import re
import requests
import datetime
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, urlunparse
from threading import Lock

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

# 线程安全的计数器和锁
download_count = 0
count_lock = Lock()
print_lock = Lock()

# 多线程配置
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "10"))  # 最大线程数
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "30"))  # 请求超时时间

def safe_print(message):
    """线程安全的打印函数"""
    with print_lock:
        print(message)

def download_image_task(img_url, download_path, img_filename):
    """下载单个图片的任务函数"""
    global download_count
    try:
        response = requests.get(img_url, timeout=REQUEST_TIMEOUT, stream=True)
        if response.status_code == 200:
            # 确保目录存在
            os.makedirs(os.path.dirname(download_path), exist_ok=True)
            
            with open(download_path, "wb") as img_file:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        img_file.write(chunk)
            
            with count_lock:
                download_count += 1
                current_count = download_count
            
            safe_print(f"[{current_count}] Downloaded: {img_filename}")
            return True
        else:
            safe_print(f"[ERROR] Failed to download {img_filename}: HTTP {response.status_code}")
            return False
    except requests.exceptions.Timeout:
        safe_print(f"[ERROR] Timeout downloading {img_filename}")
        return False
    except requests.exceptions.RequestException as e:
        safe_print(f"[ERROR] Error downloading {img_filename}: {str(e)}")
        return False
    except Exception as e:
        safe_print(f"[ERROR] Unexpected error downloading {img_filename}: {str(e)}")
        return False

# 收集所有需要下载的图片信息
download_tasks = []
file_updates = []  # 存储需要更新的文件信息

# 初始化正则表达式用于匹配图片标签
img_tag_pattern = r'!\[.*?\]\((.*?)\)'

print(f"🔍 扫描markdown文件中的图片链接...")
print(f"📁 扫描目录: {markdown_folder}")
print(f"🧵 最大线程数: {MAX_WORKERS}")
print(f"⏱️ 请求超时: {REQUEST_TIMEOUT}秒")
print("=" * 60)

# 遍历文件夹中的所有 Markdown 文件
for root, dirs, files in os.walk(markdown_folder):
    for file in files:
        if file.endswith(".md"):
            md_file = os.path.join(root, file)
            
            # 读取 Markdown 文件内容
            try:
                with open(md_file, "r", encoding="utf-8") as f:
                    markdown_content = f.read()
            except Exception as e:
                safe_print(f"[WARNING] 无法读取文件 {md_file}: {str(e)}")
                continue

            # 使用正则表达式查找所有图片链接
            img_links = re.findall(img_tag_pattern, markdown_content)
            file_replacements = []  # 存储当前文件的所有替换信息
            
            for img_link in img_links:
                parsed_url = urlparse(img_link)
                if not parsed_url.scheme:
                    continue
                
                # 支持更多图片格式和特殊路径
                img_filename = None
                years = str(datetime.datetime.now().year)
                
                # 1. 标准图片格式匹配
                standard_match = re.search(r'/([^/]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff|ico))$', parsed_url.path)
                if standard_match:
                    img_filename = standard_match.group(1)
                    path_parts = parsed_url.path.split('/')
                    if len(path_parts) > 3 and re.match(r'^2\d{3}$', path_parts[3]):
                        years = path_parts[3]
                
                # 2. LaTeX公式 (yuque/__latex/xxx.svg)
                elif re.match(r'/yuque/__latex/([^/]+\.svg)$', parsed_url.path):
                    latex_match = re.search(r'/yuque/__latex/([^/]+\.svg)$', parsed_url.path)
                    img_filename = latex_match.group(1) if latex_match else None
                    years = "latex"
                
                # 3. 流程图 (yuque/__flowchart/xxx.svg)
                elif re.match(r'/yuque/__flowchart/([^/]+\.svg)$', parsed_url.path):
                    flowchart_match = re.search(r'/yuque/__flowchart/([^/]+\.svg)$', parsed_url.path)
                    img_filename = flowchart_match.group(1) if flowchart_match else None
                    years = "flowchart"
                
                # 4. PlantUML图 (__puml/xxx.svg)
                elif re.match(r'.+/__puml/([^/]+\.svg)$', parsed_url.path):
                    puml_match = re.search(r'/__puml/([^/]+\.svg)$', parsed_url.path)
                    img_filename = puml_match.group(1) if puml_match else None
                    years = "puml"
                
                # 5. 其他特殊路径的图片 (skylark/lark等)
                elif re.search(r'/([^/]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))$', parsed_url.path):
                    special_match = re.search(r'/([^/]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))$', parsed_url.path)
                    img_filename = special_match.group(1) if special_match else None
                    # 尝试从路径中提取年份
                    path_parts = parsed_url.path.split('/')
                    for part in path_parts:
                        if re.match(r'^2\d{3}$', part):
                            years = part
                            break
                    else:
                        years = "other"
                
                # 如果没有匹配到文件名，跳过这个图片
                if not img_filename:
                    safe_print(f"[SKIP] 无法识别图片格式: {parsed_url.path}")
                    continue

                if download_image:
                    download_folder = os.path.join(image_folder, years)
                    download_path = os.path.join(download_folder, img_filename)
                    
                    # 检查文件是否已存在
                    if os.path.exists(download_path):
                        safe_print(f"[SKIP] 文件已存在: {img_filename}")
                    else:
                        img_url = urlunparse(parsed_url._replace(fragment=""))
                        download_tasks.append((img_url, download_path, img_filename))
                
                if update_image_url:
                    if not replace_image_host.strip():
                        relative_path = os.path.relpath(image_folder, root).replace("\\", "/")
                        new_img_link = f'{relative_path}/{years}/{img_filename}'
                    else:
                        replace_image_host_clean = replace_image_host.rstrip("/")
                        new_img_link = f'{replace_image_host_clean}/{years}/{img_filename}'
                    file_replacements.append((img_link, new_img_link))
            
            # 如果有需要替换的链接，记录文件更新信息
            if file_replacements:
                file_updates.append((md_file, markdown_content, file_replacements))

print(f"📊 扫描完成: 发现 {len(download_tasks)} 个图片需要下载")
print(f"📝 需要更新 {len(file_updates)} 个markdown文件")
print("=" * 60)

# 多线程下载图片
if download_image and download_tasks:
    print(f"🚀 开始多线程下载图片...")
    start_time = time.time()
    
    successful_downloads = 0
    failed_downloads = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 提交所有下载任务
        future_to_task = {}
        for img_url, download_path, img_filename in download_tasks:
            future = executor.submit(download_image_task, img_url, download_path, img_filename)
            future_to_task[future] = (img_url, download_path, img_filename)
        
        # 处理完成的任务
        for future in as_completed(future_to_task):
            img_url, download_path, img_filename = future_to_task[future]
            try:
                success = future.result()
                if success:
                    successful_downloads += 1
                else:
                    failed_downloads += 1
            except Exception as exc:
                safe_print(f"[ERROR] 下载任务异常 {img_filename}: {str(exc)}")
                failed_downloads += 1
    
    end_time = time.time()
    duration = end_time - start_time
    
    print("=" * 60)
    print(f"✅ 下载完成!")
    print(f"📊 统计信息:")
    print(f"   ✅ 成功下载: {successful_downloads} 个")
    print(f"   ❌ 下载失败: {failed_downloads} 个")
    print(f"   ⏱️ 总耗时: {duration:.2f} 秒")
    print(f"   📈 平均速度: {successful_downloads/duration:.2f} 个/秒" if duration > 0 else "")
    print("=" * 60)

# 更新markdown文件中的图片链接
if update_image_url and file_updates:
    print(f"📝 开始更新markdown文件中的图片链接...")
    updated_files = 0
    
    for md_file, original_content, replacements in file_updates:
        try:
            updated_content = original_content
            for old_link, new_link in replacements:
                updated_content = updated_content.replace(old_link, new_link)
            
            with open(md_file, "w", encoding="utf-8") as f:
                f.write(updated_content)
            
            updated_files += 1
            safe_print(f"✅ 已更新: {os.path.basename(md_file)}")
        except Exception as e:
            safe_print(f"[ERROR] 更新文件失败 {md_file}: {str(e)}")
    
    print(f"📝 链接更新完成: {updated_files} 个文件")

print("\n🎉 所有任务完成!")
print(f"📁 图片保存目录: {image_folder}")
if download_image:
    total_images = len([f for f in os.listdir(image_folder) if os.path.isdir(os.path.join(image_folder, f))])
    print(f"📊 图片按年份分类保存，共 {download_count} 个图片")
print("=" * 60)

