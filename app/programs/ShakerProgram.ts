import { Program, ProgramName } from "./Program";
import { SaftBaseProgram } from "./SaftBaseProgram";
import { LobbyController } from "../LobbyController";
import Matter, { Bodies } from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class ShakerProgram extends SaftBaseProgram implements Program {

  private hit = false;
  private numberOfTilesWidth = 5;
  private numberOfTilesHeight = 4;
  private tileSize = 128;
  width = this.tileSize * this.numberOfTilesWidth;
  height = this.tileSize * this.numberOfTilesHeight;
  private halfTileSize = this.tileSize / 2;
  private holeRadius = 50;
  private hammerPosX = 1100;
  private hammerPosY = 300;

  private hammer?: Matter.Body;
  private hammerRadius = this.holeRadius;
  private gravityX: number = 0;
  private gravityY: number = 0;
  private moleRadius = this.holeRadius;
  private mole?: Matter.Body;
  private moleTimerId?: NodeJS.Timeout;

  private shaking = false;
  private shakeCounter: number = 0;
  private shakePointsNeededForFalling: number = 50;   // 2 Personen am Handy
  // private shakePointsNeededForFalling: number = 10;   // testing mit smartphone sensor
  // private shakePointsNeededForFalling: number = 4;   // testing mit dev controls

  private shakeObjectChangeTimerId?: NodeJS.Timeout;
  private shakeObjectChangeAfterSeconds: number = 5;
  private maxAmountOfFallingObjects = 3;
  private currentRandomShakingObjectNumber = 0;
  private oldShakeObjectNumber = -1;

  // TODO set correct position
  private shakerContainer?: Matter.Body;
  private shakerContainerPosX = this.halfTileSize;
  private shakerContainerPosY = this.halfTileSize;
  private shakerContainerRadius = this.holeRadius;
  private ingredient?: Matter.Body;
  private ingredientPosX = this.halfTileSize;
  private ingredientPosY = this.halfTileSize;
  private ingredientRadius = this.holeRadius;

  // secondsForFalling = 1.8;   // je nach Bildschirm. TODO: fix.
  secondsForFalling = 0.8;
  fallBlocked = false;

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- SHAKER GAME LOOP --------------------*/
  initGameLoop(fps: number) {
    // change shakeObject after X seconds
    this.shakeObjectChangeTimerId = setTimeout(() => this.triggerChangeShakeObject(), this.shakeObjectChangeAfterSeconds * 1000);

    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.hammer == null || this.mole == null) return;

      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('updateHammer', [this.hammer.position.x, this.hammer.position.y, this.mole.position.x, this.mole.position.y, this.hit, this.score]);
      this.lobbyController.sendToDisplays('updateShaking', this.shaking);
      this.lobbyController.sendToDisplays('updateScore', this.score);  
      this.lobbyController.sendToDisplays('updateShakeCounter', this.shakeCounter);  
      
      // if nobody shakes, shakecounter decreases (progressbar empties)
      // this.shakeCounter = this.shakeCounter - 0.01;
      this.shakeCounter = this.shakeCounter - 0.1;
      if (this.shakeCounter < 0) {
        this.shakeCounter = 0;
      }
        
    }, 1000 / fps);

  }

  /* -------------------- SHAKER GAME METHODS --------------------*/

  private initMole(): void {
    if (this.engine == null) return;

    this.mole = Matter.Bodies.circle(
      this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
      this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize,
      this.moleRadius,
      {
        label: 'Mole',
        isSensor: true,
        isStatic: true
      }
    );
    Matter.World.add(this.engine.world, this.mole);
    this.moleTimerId = setInterval(() => this.resetMole(), this.getRandomIntInterval(3000, 5000));
  }

  private resetMole(): void {
    if (this.mole == null || this.moleTimerId == null) return;

    Matter.Body.setPosition(this.mole,
      {
        x: this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
        y: this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize
      });
    this.moleTimerId.refresh();
  }

  private initHammer(): void {
    if (this.engine == null) return;

    this.hammer = Matter.Bodies.circle(
      this.hammerPosX, this.hammerPosY, this.hammerRadius,
      {
        label: 'Hammer',
        mass: 100
      });
    Matter.World.add(this.engine.world, this.hammer);
  }


  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.shakerContainerPosX,
      this.shakerContainerPosY,
      this.shakerContainerRadius,
      {
        label: 'Shaker',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.shakerContainer);
  }

  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredient = Matter.Bodies.circle(
      this.ingredientPosX,
      this.ingredientPosY,
      this.ingredientRadius,
      {
        label: 'Ingredient',
      });
    Matter.World.add(this.engine.world, this.ingredient);
  }

  initLevelData() {
    this.initHammer();
    this.initMole();
    this.initShakerContainer();
    this.initIngredients();
  }
  
  initMatterEventCollision() {
    Matter.Events.on(this.engine, 'collisionActive', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // TODO collision detection and score inc
        if (pair.bodyA.label === 'Ingredient' || pair.bodyB.label === 'Ingredient') {
          if (pair.bodyA.label === 'Shaker') {
            // console.log('Collision 1!')
            // TODO
            // this.score += this.scoreInc;
          } else if (pair.bodyB.label === 'Shaker') {
            // console.log('Collision 2!')
            // this.score += this.scoreInc;
          }
        }

        // if (pair.bodyA.label === 'Hammer' || pair.bodyB.label === 'Hammer') {
        //   if (pair.bodyA.label === 'Mole') {
        //     if (this.hit) {
        //       // TODO fruit falls
        //       // TODO catch fruit -> später
        //       // TODO reset    
        //       this.resetMole();
        //       this.score += this.scoreInc;
        //     }
        //   } else if (pair.bodyB.label === 'Mole') {
        //     if (this.hit) {
        //       this.resetMole();
        //       this.score += this.scoreInc;
        //     }
        //   }
        // }
      }
    });
  }

  setControllerDataPlayer1(controllerData: any): void {
    this.hammerHit();
    this.shakeMovement();
  }

  setControllerDataPlayer2(controllerData: any): void {
    this.hammerHit();
    this.shakeMovement();
  }

  private hammerHit(): void {
    this.hit = true;
    // console.log('hammerHit. hit = ' + this.hit);
    setTimeout(() => { this.hit = false; }, 300);
  }

  private shakeMovement(): void {
    this.shaking = true;
    //console.log('Controllers are shaking. Counter: ' + this.shakeCounter);
    if (this.shakeCounter < this.shakePointsNeededForFalling) {
      this.shakeCounter++;
    } else if (this.shakeCounter >= this.shakePointsNeededForFalling) {
      // console.log('shakeCounter: ' + this.shakeCounter);
      this.shakeCounter = this.shakePointsNeededForFalling;
      if (!this.fallBlocked) {
        this.fallBlocked = true;
              setTimeout(() => { 
                this.triggerFallOfIngredient(this.currentRandomShakingObjectNumber);
                this.shakeCounter = this.shakeCounter * 0.6;
                this.fallBlocked = false;
              }, 100);
         }
        // setTimeout(() => { this.shakeCounter = 0; }, 50);

    }
    setTimeout(() => { this.shaking = false; }, 50);
  }

  // private stopShaking(): void {
  //     this.shaking = false;
  //     console.log('stopShaking. shaking = '+this.shaking);
  // }

  private triggerFallOfIngredient(ingredientNumber: number): void {
    //console.log("Ingredient shall fall, number: "+ingredientNumber);
    // TODO: send number
    this.lobbyController.sendToDisplays('updateFall', true);

    // after some seconds (test!) the fruit reached shaker -> give points 
    // TODO: solve with collision!! not with estimating seconds for falling...
    
    if (this.allIngredientNumbersOnList.includes(ingredientNumber)) {

      setTimeout(() => { 
        this.score += this.scoreInc;
        this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientNumber);
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [this.scoreInc, ingredientNumber]); 
      }, this.secondsForFalling * 1000);

   } else {
      // TODO: wrong ingredient! descrease score? display message?
      setTimeout(() => { 
        //console.log('catched a wrong ingredient, NOT on list!!! -50 Punkte.');
        this.score -= this.scoreInc;
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [-this.scoreInc, ingredientNumber]); 
      }, this.secondsForFalling * 1000);

    }
      
    }

  private triggerChangeShakeObject(): void {
    //console.log('Time for a new plant!');

    this.oldShakeObjectNumber = this.currentRandomShakingObjectNumber;
    this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfFallingObjects);
    while (this.oldShakeObjectNumber == this.currentRandomShakingObjectNumber) {
      // avoid changing to the same shakeObject (i.e. 2x apple tree)
      this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfFallingObjects);
    }

    this.lobbyController.sendToDisplays('changeShakeObject', this.currentRandomShakingObjectNumber);

    if (this.shakeObjectChangeTimerId != null) {
      this.shakeObjectChangeTimerId.refresh();
    }

    // new plant -> shake effect back to 0
    this.shakeCounter = 0;

  }

  collectLevelData() {
    let data: any[] = [];
    if (this.mole == null) return data;

    data.push(this.numberOfTilesWidth);
    data.push(this.numberOfTilesHeight);
    // Hammer Start Position to left upper corner hole
    data.push(this.hammerPosX);
    data.push(this.hammerPosY);
    // Mole Start Position
    data.push(this.mole.position.x);
    data.push(this.mole.position.y);

    this.generateIngredientListNumbers();
    data.push(this.allIngredientNumbersOnList);
    // this.lobbyController.sendToDisplays('allIngredientNumbersOnList', this.allIngredientNumbersOnList);
    data.push(this.shakePointsNeededForFalling);

    return data;
  }

  clearInGameTimers() {
    if (this.moleTimerId != null) clearInterval(this.moleTimerId);
    if (this.shakeObjectChangeTimerId != null) clearTimeout(this.shakeObjectChangeTimerId);
  }

}