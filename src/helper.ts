import fs from 'fs'
import path from 'path'

export class Helper {
	public static replace (string:string, search:string, replace:string) {
		return string.split(search).join(replace)
		// con la siguiente opción falla cuando se hace value=Helper.replace(value,"\\'","\\''")
		// return string.replace(new RegExp(search, 'g'), replace)
	}

	public static clone (obj:any):any {
		return obj && typeof obj === 'object' ? JSON.parse(JSON.stringify(obj)) : obj
	}

	public static cloneOperand (obj:any):any {
		const children:any[] = []
		if (obj.children) {
			for (const k in obj.children) {
				const p = obj.children[k]
				const child = Helper.clone(p)
				children.push(child)
			}
		}
		return new obj.constructor(obj.name, children)
	}

	public static isObject (obj:any):boolean {
		return obj && typeof obj === 'object' && obj.constructor === Object
	}

	public static isEmpty (value:any):boolean {
		return value === null || value === undefined || value.toString().trim().length === 0
	}

	public static nvl (value:any, _default:any):any {
		return !this.isEmpty(value) ? value : _default
	}

	public static async existsPath (fullPath:string):Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			fs.access(fullPath, (err) => {
				if (err) {
					resolve(false)
				} else {
					resolve(true)
				}
			})
		})
	}

	public static async createIfNotExists (sourcePath:string):Promise<void> {
		const fullPath = Helper.resolvePath(sourcePath)
		if (await Helper.existsPath(fullPath)) { return }
		return new Promise<void>((resolve, reject) => {
			fs.mkdir(fullPath, { recursive: true }, err => err ? reject(err) : resolve())
		})
	}

	public static resolvePath (source:string):string {
		const _source = source.trim()
		if (_source.startsWith('.')) {
			return path.join(process.argv0, source)
		}
		if (_source.startsWith('~')) {
			return _source.replace('~', process.env.HOME as string)
		}
		return source
	}

	public static async readFile (filePath: string): Promise<string|null> {
		const fullPath = Helper.resolvePath(filePath)
		if (!await Helper.existsPath(fullPath)) {
			return null
		}
		return new Promise<string>((resolve, reject) => {
			fs.readFile(fullPath, (err, data) => err ? reject(err) : resolve(data.toString('utf8')))
		})
	}

	public static async removeFile (fullPath:string):Promise<void> {
		if (!await Helper.existsPath(fullPath)) { return }
		return new Promise<void>((resolve, reject) => {
			fs.unlink(fullPath, err => err ? reject(err) : resolve())
		})
	}

	public static async copyFile (src: string, dest:string): Promise<void> {
		if (!await Helper.existsPath(src)) {
			throw new Error(`not exists ${src}`)
		}
		return new Promise<void>((resolve, reject) => {
			fs.copyFile(src, dest, err => err ? reject(err) : resolve())
		})
	}

	public static async writeFile (filePath: string, content: string): Promise<void> {
		const dir = path.dirname(filePath)
		if (!await Helper.existsPath(dir)) {
			await Helper.mkdir(dir)
		}
		return new Promise<void>((resolve, reject) => {
			fs.writeFile(filePath, content, { encoding: 'utf8' }, err => err ? reject(err) : resolve())
		})
	}

	public static async mkdir (fullPath:string):Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.mkdir(fullPath, { recursive: true }, err => err ? reject(err) : resolve())
		})
	}

	public static async lstat (fullPath:string):Promise<fs.Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.lstat(fullPath, (err, stats) => err
				? reject(err)
				: resolve(stats))
		})
	}

	public static getEnvironmentVariable (text:string):string|undefined {
		const startIndex = text.indexOf('${')
		if (startIndex < 0) {
			return undefined
		}
		const endIndex = text.indexOf('}', startIndex + 2)
		if (endIndex < 0) {
			throw new Error(`Environment variable not found end character "?" in ${text}`)
		}
		return text.substring(startIndex + 2, endIndex)
	}

	public static solveEnvironmentVariables (source:any): void {
		if (typeof source !== 'object') {
			return
		}
		for (const name in source) {
			const child = source[name]
			if (typeof child === 'string' && child.indexOf('${') >= 0) {
				source[name] = Helper.replaceEnvironmentVariable(child)
			} else if (typeof child === 'object') {
				Helper.solveEnvironmentVariables(child)
			}
		}
	}

	private static replaceEnvironmentVariable (text:any): any {
		// there can be more than one environment variable in text
		while (text.indexOf('${') >= 0) {
			const environmentVariable = Helper.getEnvironmentVariable(text)
			if (!environmentVariable) {
				continue
			}
			const environmentVariableValue = process.env[environmentVariable]
			if (environmentVariableValue === undefined || environmentVariableValue === null) {
				text = Helper.replace(text, '${' + environmentVariable + '}', '')
			} else {
				const objValue = Helper.tryParse(environmentVariableValue)
				const value = objValue ? JSON.stringify(objValue) : environmentVariableValue
				text = Helper.replace(text, '${' + environmentVariable + '}', value)
			}
		}
		return text
	}

	public static tryParse (value:string):any|null {
		try {
			return JSON.parse(value)
		} catch {
			return null
		}
	}
}
