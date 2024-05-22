### 简介

应该能支持 nexusmods 上大部分怪物猎人崛起 mod 的目录结构，使 mod 安装到正确的位置上。

### 安装

目前的开发环境：

+ NodeJS 20.9.0(Iron)
+ npm 10.1.0
+ yarn 1.22.21

更新的版本应该也可以，旧的版本不太清楚，不知道 package.json 中 devDependencies 对此是否有影响。

除了实现扩展的代码，基础环境搭建来自 `Nexus-Mods/sample-extension`，所以 registry 也都配置成了 `https://registry.yarnpkg.com`。

```shell
npm config set registry https://registry.yarnpkg.com/
yarn config set registry https://registry.yarnpkg.com
```

使用以下命令安装依赖、编译、打包，然后将目录下的压缩包 monsterhunterrise.7z 拖到 Vortex 管理器 Extensions 页面的 Drop File(s) 上安装。

```shell
yarn install
yarn build
yarn bundle7z
```

### 文档

+ [Nexus-Mods/Vortex/Wiki](https://github.com/Nexus-Mods/Vortex/wiki)

### 工具

+ [mhvuze/MonsterHunterRiseModding](https://github.com/mhvuze/MonsterHunterRiseModding)

### 参考

+ [Nexus-Mods/sample-extension](https://github.com/Nexus-Mods/sample-extension)
+ [IDCs/game-mhr](https://github.com/IDCs/game-mhr)
+ [E1337Kat/cyberpunk2077_ext_redux](https://github.com/E1337Kat/cyberpunk2077_ext_redux)
+ [Nexus-Mods/vortex-games](https://github.com/Nexus-Mods/vortex-games)
