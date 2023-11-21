let url = ""
if (!process.env.SPACE_URL) {
    url = "https://www.yuque.com"
} else {
    // 团队空间的URL，结尾不带 '/'
    // 样例  https://xxxx.yuque.com
    url = process.env.SPACE_URL
}

export const baseurl = url

