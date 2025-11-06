export function validateAccessKeyId(accessKeyId: string): boolean {
    if (!accessKeyId) return false
    return /^[A-Za-z0-9]{16,128}$/.test(accessKeyId)
}

export function validateAccessKeySecret(accessKeySecret: string): boolean {
    if (!accessKeySecret) return false
    return accessKeySecret.length >= 30 && accessKeySecret.length <= 128
}

export function validateRegion(region: string): boolean {
    if (!region) return false
    return /^[a-z]{2,}-[a-z0-9-]+$/.test(region)
}

export function validateAccountName(name: string): boolean {
    if (!name) return false
    return /^[\u4e00-\u9fa5a-zA-Z0-9_-]{2,50}$/.test(name)
}

export function validateAssetName(name: string): boolean {
    if (!name) return false
    return name.length >= 1 && name.length <= 128
}

export function validateJSON(jsonStr: string): boolean {
    if (!jsonStr) return true
    try {
        JSON.parse(jsonStr)
        return true
    } catch {
        return false
    }
}

export function validateSyncInterval(interval: number): boolean {
    return interval >= 5 && interval <= 1440
}

export function validateCost(cost: number): boolean {
    return cost >= 0
}

export function validateEmail(email: string): boolean {
    if (!email) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateIP(ip: string): boolean {
    if (!ip) return false
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipv4Regex.test(ip)) return false
    const parts = ip.split('.')
    return parts.every((part) => parseInt(part) >= 0 && parseInt(part) <= 255)
}

export function validatePort(port: number): boolean {
    return port >= 1 && port <= 65535
}

export function validateURL(url: string): boolean {
    if (!url) return false
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}
