import Character from 'objects/Character';
import Projectile from 'objects/Projectile';

export default class LoaderScene extends Phaser.Scene {

  constructor() {
    super({key: 'LoaderScene'});
  }

  preload() {
    const { width, height } = this.cameras.main;

    this.loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 75,
      text: 'Loading...',
      style: {
        font: '50px monospace',
        fill: '#ffffff'
      }
    });
    this.loadingText.setOrigin(0.5, 0.5);

    this.assetText = this.make.text({
      x: width / 2,
      y: height / 2 + 60,
      style: {
        font: '14px monospace',
        fill: '#ffffff'
      }
    });
    this.assetText.setOrigin(0.5, 0.5);

    this.progressBar = this.add.graphics();
    this.progressBar.lineStyle(2, 0xffffff, 1);
    this.progressBar.fillStyle(0xb4d455);
    this.progressBar.strokeRect(width * .2, height / 2, width * .8 - width * .2, 32);
  }

  create() {
    this.load.setBaseURL('./assets/');
    this.load.on('start', this.loadStart, this);
    this.load.on('progress', this.loadProgress, this);
    this.load.on('fileprogress', this.loadFileProgress, this);
    this.load.on('complete', this.loadCompleted, this);

    this.load.start();
  }

  /**
   * Called when the loader has started loading assets.
   * @param {object} loader Instance of the global Phaser loader.
   */
  loadStart(loader) {
    WebFont.load({
      google: {
        families: ['Jim Nightshade', 'Fjalla One', 'Noto Sans']
      }
    });

    const assets =  this.cache.json.get('assets');

    //Load Images
    for(let image of assets.image) {
      loader.image(image.key, image.texture);
      //loader.image(image);
    }
    //loader.image(assets.image);

    //Load Spritesheets
    for(let spritesheet of assets.spritesheet) {
      loader.spritesheet(spritesheet.key, spritesheet.texture, spritesheet);
    }

    //Load Atlas
    for(let atlas of assets.atlas) {
      loader.atlas(atlas);
    }

    //Load TileMaps
    for(let tileMap of assets.tileMap) {
      loader.tilemapTiledJSON(tileMap.key, tileMap.data);
    }

    //Load JSON files
    this.load.json('config', '../config.json');
    for(let json of assets.json){
      this.load.json(json.key, json.data);
    }

    // Hack to fix progress loaders
    this.load.totalToLoad = this.load.list.size;

    /*
      Assets from
      https://opengameart.org/content/dungeon-crawl-32x32-tiles
      https://opengameart.org/content/user-interface-element-pack-panels-buttons-sliders-tables-icons
    */
  }

  /**
   * Keeps track of individual file loading progress.
   * @param {object} file File currently being loaded
   * @param {float} value Percentage of load of this file ranging from 0 to 1.
   */
  loadFileProgress(file, value) {
    this.assetText.setText(`${file.url} ${((value || 1) * 100).toFixed(2)}%`)
  }

  /**
   * Keeps track of global loading process.
   * @param {float} value Percentage of load progress. Appears to be currently broken in Phaser 3.
   */
  loadProgress(value) {
    const { width, height } = this.cameras.main;
    this.progressBar.fillRect(width * .2, height / 2, (width * .8 - width * .2) * value, 32)
  }

  /**
   * Called when the loader has completed loading all assets.
   */
  loadCompleted() {
    //Build animations
    Character.buildAnimations(this);
    Projectile.buildAnimations(this);
    this.scene.start('TitleScene');
  }

  update() {
  }
}
